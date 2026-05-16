script {
    use dexlyn_swap::router;
    use supra_framework::coin;
    use std::signer;

    fun main<A, B, C, CurveAB, CurveBC, CurveCA>(
        account: &signer,
        amount_in: u64,
        min_out_ab: u64,
        min_out_bc: u64,
        min_out_ca: u64,
    ) {
        let coins = coin::withdraw<A>(account, amount_in);
        let coins_b = router::swap_exact_coin_for_coin<A, B, CurveAB>(coins, min_out_ab);
        let coins_c = router::swap_exact_coin_for_coin<B, C, CurveBC>(coins_b, min_out_bc);
        let coins_a = router::swap_exact_coin_for_coin<C, A, CurveCA>(coins_c, min_out_ca);
        coin::deposit<A>(signer::address_of(account), coins_a);
    }
}