use soroban_sdk::{panic_with_error, Address, BytesN, Env};

use crate::errors::Error;
use crate::events;
use crate::storage::{self, Config, PendingConfig, PendingUpgrade, BPS_DENOM};

// --- Authorization guards --------------------------------------------------

/// Require that `caller` is the current admin AND has authorized this invocation.
/// Both checks matter: `require_auth` proves the signature; the identity check
/// enforces the RBAC role.
pub fn require_admin(env: &Env, caller: &Address) {
    caller.require_auth();
    if *caller != storage::get_admin(env) {
        panic_with_error!(env, Error::Unauthorized);
    }
}

pub fn require_pauser(env: &Env, caller: &Address) {
    caller.require_auth();
    // Admin implicitly outranks the pauser role.
    if *caller != storage::get_pauser(env) && *caller != storage::get_admin(env) {
        panic_with_error!(env, Error::Unauthorized);
    }
}

/// Block state-growing actions while paused. Users can always *exit*
/// (close/withdraw/liquidate remain available) so funds are never trapped.
pub fn require_not_paused(env: &Env) {
    if storage::is_paused(env) {
        panic_with_error!(env, Error::Paused);
    }
}

// --- Circuit breaker -------------------------------------------------------

pub fn pause(env: &Env, caller: &Address) {
    require_pauser(env, caller);
    storage::set_paused(env, true);
    storage::extend_instance(env);
    events::paused(env, caller);
}

pub fn unpause(env: &Env, caller: &Address) {
    // Only the admin can lift a pause (higher bar than tripping it).
    require_admin(env, caller);
    storage::set_paused(env, false);
    storage::extend_instance(env);
    events::unpaused(env, caller);
}

// --- 2-step admin handover -------------------------------------------------
// A two-step transfer prevents accidentally locking out control by handing the
// role to a wrong/uncontrolled address: the new admin must actively accept.

pub fn transfer_admin(env: &Env, caller: &Address, new_admin: &Address) {
    require_admin(env, caller);
    storage::set_pending_admin(env, new_admin);
    storage::extend_instance(env);
}

pub fn accept_admin(env: &Env, caller: &Address) {
    caller.require_auth();
    let pending = storage::get_pending_admin(env);
    match pending {
        Some(p) if p == *caller => {
            storage::set_admin(env, caller);
            storage::clear_pending_admin(env);
            storage::extend_instance(env);
            events::admin_transferred(env, caller);
        }
        _ => panic_with_error!(env, Error::Unauthorized),
    }
}

// --- Role setters ----------------------------------------------------------

pub fn set_pauser(env: &Env, caller: &Address, pauser: &Address) {
    require_admin(env, caller);
    storage::set_pauser(env, pauser);
    storage::extend_instance(env);
    events::config_updated(env, caller);
}

pub fn set_fee_collector(env: &Env, caller: &Address, collector: &Address) {
    require_admin(env, caller);
    storage::set_fee_collector(env, collector);
    storage::extend_instance(env);
    events::config_updated(env, caller);
}

pub fn set_oracle_updater(env: &Env, caller: &Address, updater: &Address) {
    require_admin(env, caller);
    storage::set_oracle_updater(env, updater);
    storage::extend_instance(env);
    events::config_updated(env, caller);
}

// --- Parameter governance --------------------------------------------------

/// Validate that a Config is internally consistent and within safe bounds.
/// Rejects nonsensical or dangerous parameter sets before they can be stored.
pub fn validate_config(env: &Env, cfg: &Config) {
    let ok = cfg.init_margin_bps > cfg.maint_margin_bps
        && cfg.maint_margin_bps > 0
        && cfg.init_margin_bps <= BPS_DENOM
        && cfg.trading_fee_bps >= 0
        && cfg.trading_fee_bps <= 1_000 // hard cap fees at 10%
        && cfg.liq_penalty_bps >= 0
        && cfg.liq_penalty_bps <= BPS_DENOM
        && cfg.liq_reward_bps >= 0
        && cfg.liq_reward_bps <= BPS_DENOM
        && cfg.funding_admin_cut_bps >= 0
        && cfg.funding_admin_cut_bps <= BPS_DENOM
        && cfg.max_funding_bps >= 0
        && cfg.max_funding_bps <= BPS_DENOM
        && cfg.oracle_max_deviation_bps > 0
        && cfg.oracle_max_deviation_bps <= BPS_DENOM
        && cfg.funding_interval > 0
        && cfg.oracle_staleness > 0
        && cfg.min_position_size > 0;
    if !ok {
        panic_with_error!(env, Error::InvalidParams);
    }
}

// Parameter changes and code upgrades are the two highest-impact admin powers,
// so both run through a two-phase **timelock**: an admin first *proposes* the
// change, and it can only be *executed* after `timelock_delay` seconds. This
// gives users a guaranteed window to exit before a governance action takes
// effect (defence against a compromised/rogue admin key), while `cancel` lets a
// legitimate admin abort a mistaken or malicious-looking proposal.

/// Queue a config change. Validated up-front so bad params fail fast.
pub fn propose_config(env: &Env, caller: &Address, cfg: &Config) {
    require_admin(env, caller);
    validate_config(env, cfg);
    let eta = env.ledger().timestamp() + storage::get_timelock_delay(env);
    storage::set_pending_config(
        env,
        &PendingConfig {
            config: cfg.clone(),
            eta,
        },
    );
    storage::extend_instance(env);
    events::config_proposed(env, caller, eta);
}

/// Apply a previously-queued config change once its timelock has elapsed.
pub fn execute_config(env: &Env, caller: &Address) {
    require_admin(env, caller);
    let pending = match storage::get_pending_config(env) {
        Some(p) => p,
        None => panic_with_error!(env, Error::NothingPending),
    };
    if env.ledger().timestamp() < pending.eta {
        panic_with_error!(env, Error::TimelockNotReady);
    }
    // Re-validate defensively in case bounds changed since the proposal.
    validate_config(env, &pending.config);
    storage::set_config(env, &pending.config);
    storage::clear_pending_config(env);
    storage::extend_instance(env);
    events::config_updated(env, caller);
}

pub fn cancel_config(env: &Env, caller: &Address) {
    require_admin(env, caller);
    if storage::get_pending_config(env).is_none() {
        panic_with_error!(env, Error::NothingPending);
    }
    storage::clear_pending_config(env);
    storage::extend_instance(env);
    events::gov_cancelled(env, caller);
}

// --- Upgradeability (timelocked) -------------------------------------------
// Admin-controlled WASM swap behind the same timelock. In production the admin
// should additionally be a multisig / governance address (see deployment
// checklist). Events provide a full audit trail of every proposed/executed change.

pub fn propose_upgrade(env: &Env, caller: &Address, new_wasm_hash: BytesN<32>) {
    require_admin(env, caller);
    let eta = env.ledger().timestamp() + storage::get_timelock_delay(env);
    storage::set_pending_upgrade(
        env,
        &PendingUpgrade {
            wasm_hash: new_wasm_hash,
            eta,
        },
    );
    storage::extend_instance(env);
    events::upgrade_proposed(env, caller, eta);
}

pub fn execute_upgrade(env: &Env, caller: &Address) {
    require_admin(env, caller);
    let pending = match storage::get_pending_upgrade(env) {
        Some(p) => p,
        None => panic_with_error!(env, Error::NothingPending),
    };
    if env.ledger().timestamp() < pending.eta {
        panic_with_error!(env, Error::TimelockNotReady);
    }
    env.deployer()
        .update_current_contract_wasm(pending.wasm_hash);
    storage::clear_pending_upgrade(env);
    events::upgraded(env, caller);
}

pub fn cancel_upgrade(env: &Env, caller: &Address) {
    require_admin(env, caller);
    if storage::get_pending_upgrade(env).is_none() {
        panic_with_error!(env, Error::NothingPending);
    }
    storage::clear_pending_upgrade(env);
    storage::extend_instance(env);
    events::gov_cancelled(env, caller);
}
