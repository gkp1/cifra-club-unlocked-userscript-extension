<a href="../README.md"><img src="flags/us.svg" width="20" height="15" alt=""> English</a> &nbsp;·&nbsp; <img src="flags/br.svg" width="20" height="15" alt=""> **Português (Brasil)**

# Cifra Club Desbloqueado · Userscript Extensão

Um userscript pequeno que deixa o [Cifra Club](https://www.cifraclub.com.br) melhor pra tocar.

- **Cifra inteira numa tela só:** aperte `L` e a música cabe em colunas com fonte automática, sem rolagem
- **Dividir em colunas sem anúncio:** o "Dividir em colunas" liga na hora
- **Pedal passador sem anúncio:** o "Pedal passador" abre direto (precisa de login grátis)
- **Tema claro/escuro:** aperte `D` pra trocar o tema do site e do modo tela cheia juntos

| Escuro | Claro |
|---|---|
| ![O modo tela cheia no tema escuro: a música inteira em colunas com acordes destacados](../screenshots/pt-BR/view-dark.png) | ![O modo tela cheia no tema claro](../screenshots/pt-BR/view-light.png) |

Chega disso:

![O popup "Assista um anúncio rápido" que aparece ao escolher Dividir em colunas](../screenshots/ad-popup.png)

## Instalação

1. Instale um gerenciador de userscripts: [Tampermonkey](https://www.tampermonkey.net/) ou [Violentmonkey](https://violentmonkey.github.io/). No Firefox, o recomendado é o [Violentmonkey](https://addons.mozilla.org/firefox/addon/violentmonkey/).

   ⚠️ **No Chrome ou Edge: clique com o botão direito no ícone da extensão → Gerenciar extensão → ative Permitir scripts de usuário (Allow User Scripts).**
2. Clique aqui: **[Instalar o script](https://raw.githubusercontent.com/gkp1/cifra-club-unlocked-userscript-extension/main/cifraclub-unlocked.user.js)**. O gerenciador abre uma página de instalação; clique em **Instalar**.
3. Abra qualquer cifra ou recarregue a página do Cifra Club. Uma faixa laranja "Aperte L" aparece acima da cifra.

As atualizações chegam sozinhas pelo gerenciador.

## Atalhos

| Tecla | O que faz | Onde |
|---|---|---|
| `L` | Abre / fecha o modo tela cheia | páginas de cifra |
| `D` | Tema claro / escuro | em todo o site |
| `F` | Tela cheia do navegador | modo tela cheia |
| `+` / `-` | Aumenta / diminui o texto | modo tela cheia |
| `0` | Volta ao tamanho automático | modo tela cheia |
| `Esc` | Fecha o modo tela cheia | modo tela cheia |

Os botões e dicas seguem o idioma do navegador: português se o navegador estiver em português, inglês nos outros casos.

## Configurações

Abra o script no gerenciador e mude as linhas do topo:

```js
const KEY_VIEW = 'l';        // liga/desliga o modo tela cheia
const KEY_BROWSER_FS = 'f';  // tela cheia do navegador (dentro do modo)
const KEY_THEME = 'd';       // tema claro/escuro (site e modo tela cheia)
const START_ON = false;      // abrir já no modo tela cheia? (depois lembra a última escolha)
const UNLOCK = true;         // libera "Dividir em colunas" e "Pedal passador" sem anúncio
```

## Como o desbloqueio funciona

Quando você assiste o anúncio, o Cifra Club guarda um passe de 24 horas num cookie no seu navegador. O script grava esse mesmo cookie e renova quando ele vence, então o site já considera o recurso liberado. É só isso:

- Tudo acontece no seu navegador e nada é enviado pra lugar nenhum. A única coisa que o script baixa são as fontes do modo tela cheia (Inter e JetBrains Mono, do Google Fonts).
- Não mexe na sua conta, não faz login por você e não finge que você é assinante.
- Recursos que o Cifra Club confere no servidor continuam como estão.

Se o Cifra Club mudar esse funcionamento, o desbloqueio pode parar até o script ser atualizado. [Abra uma issue](https://github.com/gkp1/cifra-club-unlocked-userscript-extension/issues) se perceber isso.

## Observações

- Projeto não oficial, sem ligação com o Cifra Club ou a Studio Sol.
- Se você usa muito o Cifra Club, considere apoiar com o [Cifra Club PRO](https://www.cifraclub.com.br/assine/).

## Licença

[MIT](../LICENSE)
