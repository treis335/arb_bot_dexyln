const blessed = require('blessed');

class TxOverlay {
    constructor(screen) {
        this.screen = screen;
        this.lines = [];
        this.visible = false;
        this.timeoutId = null;
        this.originalLog = null; // Guarda referência ao console.log original

        this.box = blessed.box({
            parent: screen,
            top: 'center',
            left: 'center',
            width: '60%',
            height: '40%',
            tags: true,
            border: { type: 'line' },
            style: {
                border: { fg: 'cyan' },
                fg: 'white',
                bg: 'black',
            },
            label: ' {bold}{cyan-fg}EXECUÇÃO DA TRANSAÇÃO{/} ',
            scrollable: true,
            alwaysScroll: true,
            scrollbar: { ch: '│', style: { fg: 'cyan' } },
            keys: true,
            hidden: true,
            wrap: false,
            content: '',
        });
        this.box.hide();

        // Recentralizar se o terminal for redimensionado
        screen.on('resize', () => {
            if (this.visible) {
                this.box.position.top = 'center';
                this.box.position.left = 'center';
                this.screen.render();
            }
        });
    }

    /**
     * Mostra a janela e captura o console.log.
     */
    show() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        this.lines = [];
        this.box.setContent('');
        this.box.show();
        this.visible = true;

        // Guarda o console.log original e redireciona para dentro da janela
        if (!this.originalLog) {
            this.originalLog = console.log;
        }
        console.log = (...args) => {
            this.log(args.join(' '));
        };

        this.screen.render();
    }

    /**
     * Esconde a janela, restaura console.log e limpa o ecrã completamente.
     */
    hide() {
        if (!this.visible) return;

        this.box.hide();
        this.visible = false;

        // Restaura o console.log original
        if (this.originalLog) {
            console.log = this.originalLog;
            this.originalLog = null;
        }

        // Força uma renderização completa para limpar qualquer resíduo
        this.screen.render();

        // 🔥 Limpeza extra: apaga a linha do cursor e redesenha tudo
        // Isto resolve textos que tenham sido escritos diretamente pelo SDK
        this.screen.program.write('\x1b[2J'); // limpa ecrã (opcional, pode causar flicker)
        this.screen.render();
    }

    /**
     * Adiciona uma mensagem à janela.
     */
    log(msg) {
        // Remove caracteres de controlo que possam interferir
        const clean = msg.replace(/\x1b\[[0-9;]*m/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        if (!clean.trim()) return;

        this.lines.push(clean);
        if (this.lines.length > 100) this.lines.shift();
        this.box.setContent(this.lines.join('\n'));
        this.box.scrollTo(this.lines.length);
        if (this.visible) {
            this.screen.render();
        }
    }

    /**
     * Exibe mensagem de sucesso com hash.
     */
    success(hash) {
        this.log('{green-fg}✅ Transação submetida com sucesso!{/}');
        this.log(`{grey-fg}Hash: {/}{bright-cyan-fg}${hash}{/}`);
        this.log(`{grey-fg}Explorer: https://suprascan.io/tx/${hash}{/}`);
        this.timeoutId = setTimeout(() => this.hide(), 8000);
    }

    /**
     * Exibe mensagem de erro.
     */
    error(msg) {
        this.log(`{red-fg}❌ Erro: ${msg}{/}`);
        this.timeoutId = setTimeout(() => this.hide(), 5000);
    }
}

module.exports = TxOverlay;