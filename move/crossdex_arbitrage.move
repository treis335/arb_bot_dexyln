script {
    use std::signer;
    use supra_framework::coin;
    use dexlyn_swap::router as dexlyn;
    use spike_amm::amm_router as spikey;

    fun main<A, B, C, CurveAB, CurveBC, CurveCA>(
        account: &signer,
        amount_in: u64,
        min_out_ab: u64,
        min_out_bc: u64,
        min_out_ca: u64,
    ) {
        // 1. Levantar os tokens da conta
        let coins_a = coin::withdraw<A>(account, amount_in);

        // 2. Hop A → B na Dexlyn
        let coins_b = dexlyn::swap_exact_coin_for_coin<A, B, CurveAB>(coins_a, min_out_ab);

        // 3. Hop B → C na Spikey
        //    A função pública swap aceita Coin<B> diretamente (Coin é um FungibleAsset)
        let coins_c = spikey::swap<B, C, CurveBC>(account, coins_b, signer::address_of(account));

        // 4. Hop C → A na Dexlyn
        let coins_a_final = dexlyn::swap_exact_coin_for_coin<C, A, CurveCA>(coins_c, min_out_ca);

        // 5. Verificar lucro mínimo (se o montante final não cobre o inicial, aborta)
        let final_value = coin::value(&coins_a_final);
        assert!(final_value >= amount_in, 1);

        // 6. Depositar de volta
        coin::deposit<A>(signer::address_of(account), coins_a_final);
    }
}