//! GPU model → HEH coefficient table (see docs/cu-spec.md).

use soroban_sdk::{panic_with_error, Address, Env, Symbol};

use crate::admin;
use crate::errors::Error;
use crate::events;
use crate::storage::{self, SCALE};

/// Seed the MVP coefficient table from cu-spec.md.
pub fn seed_defaults(env: &Env) {
    set_unchecked(env, Symbol::new(env, "H100"), SCALE); // 1.00
    set_unchecked(env, Symbol::new(env, "H200"), 14_000_000); // 1.40
    set_unchecked(env, Symbol::new(env, "B200"), 25_000_000); // 2.50
    set_unchecked(env, Symbol::new(env, "GB200"), 35_000_000); // 3.50
    set_unchecked(env, Symbol::new(env, "A100"), 6_000_000); // 0.60
    set_unchecked(env, Symbol::new(env, "RTX4090"), 3_500_000); // 0.35
}

fn set_unchecked(env: &Env, model: Symbol, coeff: i128) {
    storage::set_coefficient(env, &model, coeff);
}

/// Governance-gated coefficient update (timelocked via propose/execute config
/// is heavier; for MVP coefficients use admin + event, with optional timelock
/// later). Admin-only for demo speed; documented as governance-managed.
pub fn set_coefficient(env: &Env, caller: &Address, model: Symbol, coeff: i128) {
    admin::require_admin(env, caller);
    if coeff <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
    storage::set_coefficient(env, &model, coeff);
    storage::extend_instance(env);
    events::coefficient_set(env, &model, coeff);
}

pub fn get_coefficient(env: &Env, model: &Symbol) -> i128 {
    match storage::get_coefficient(env, model) {
        Some(c) if c > 0 => c,
        _ => panic_with_error!(env, Error::UnknownGpuModel),
    }
}

#[allow(dead_code)]
pub fn try_get_coefficient(env: &Env, model: &Symbol) -> Option<i128> {
    storage::get_coefficient(env, model)
}
