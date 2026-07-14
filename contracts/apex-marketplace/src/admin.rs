use soroban_sdk::{panic_with_error, Address, BytesN, Env};

use crate::errors::Error;
use crate::events;
use crate::storage::{self, Config, PendingConfig, PendingUpgrade, BPS_DENOM};

pub fn require_admin(env: &Env, caller: &Address) {
    caller.require_auth();
    if *caller != storage::get_admin(env) {
        panic_with_error!(env, Error::Unauthorized);
    }
}

pub fn require_pauser(env: &Env, caller: &Address) {
    caller.require_auth();
    if *caller != storage::get_pauser(env) && *caller != storage::get_admin(env) {
        panic_with_error!(env, Error::Unauthorized);
    }
}

pub fn require_verifier(env: &Env, caller: &Address) {
    caller.require_auth();
    if *caller != storage::get_verifier(env) && *caller != storage::get_admin(env) {
        panic_with_error!(env, Error::Unauthorized);
    }
}

pub fn require_not_paused(env: &Env) {
    if storage::is_paused(env) {
        panic_with_error!(env, Error::Paused);
    }
}

pub fn pause(env: &Env, caller: &Address) {
    require_pauser(env, caller);
    storage::set_paused(env, true);
    storage::extend_instance(env);
    events::paused(env, caller);
}

pub fn unpause(env: &Env, caller: &Address) {
    require_admin(env, caller);
    storage::set_paused(env, false);
    storage::extend_instance(env);
    events::unpaused(env, caller);
}

pub fn transfer_admin(env: &Env, caller: &Address, new_admin: &Address) {
    require_admin(env, caller);
    storage::set_pending_admin(env, new_admin);
    storage::extend_instance(env);
}

pub fn accept_admin(env: &Env, caller: &Address) {
    caller.require_auth();
    match storage::get_pending_admin(env) {
        Some(p) if p == *caller => {
            storage::set_admin(env, caller);
            storage::clear_pending_admin(env);
            storage::extend_instance(env);
            events::admin_transferred(env, caller);
        }
        _ => panic_with_error!(env, Error::Unauthorized),
    }
}

pub fn set_pauser(env: &Env, caller: &Address, pauser: &Address) {
    require_admin(env, caller);
    storage::set_pauser(env, pauser);
    storage::extend_instance(env);
    events::config_updated(env, caller);
}

pub fn set_verifier(env: &Env, caller: &Address, verifier: &Address) {
    require_admin(env, caller);
    storage::set_verifier(env, verifier);
    storage::extend_instance(env);
    events::config_updated(env, caller);
}

pub fn set_futures_oracle(env: &Env, caller: &Address, futures: &Address) {
    require_admin(env, caller);
    storage::set_futures_oracle(env, futures);
    storage::extend_instance(env);
    events::config_updated(env, caller);
}

pub fn validate_config(env: &Env, cfg: &Config) {
    let ok = cfg.oracle_staleness > 0
        && cfg.settlement_fee_bps >= 0
        && cfg.settlement_fee_bps <= 1_000
        && cfg.settlement_fee_bps <= BPS_DENOM;
    if !ok {
        panic_with_error!(env, Error::InvalidParams);
    }
}

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

pub fn execute_config(env: &Env, caller: &Address) {
    require_admin(env, caller);
    let pending = match storage::get_pending_config(env) {
        Some(p) => p,
        None => panic_with_error!(env, Error::NothingPending),
    };
    if env.ledger().timestamp() < pending.eta {
        panic_with_error!(env, Error::TimelockNotReady);
    }
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
