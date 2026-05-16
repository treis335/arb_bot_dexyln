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
        // 1. Levantar os tokens de entrada da conta
        let coins = coin::withdraw<A>(account, amount_in);

        // 2. Hop A→B
        let coins_b = router::swap_exact_coin_for_coin<A, B, CurveAB>(coins, min_out_ab);
        // 3. Hop B→C
        let coins_c = router::swap_exact_coin_for_coin<B, C, CurveBC>(coins_b, min_out_bc);
        // 4. Hop C→A
        let coins_a = router::swap_exact_coin_for_coin<C, A, CurveCA>(coins_c, min_out_ca);

        // 5. Depositar de volta (lucro ou revertido se falhou)
        coin::deposit<A>(signer::address_of(account), coins_a);
    }
}