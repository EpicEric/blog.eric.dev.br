---
title: "Pare de escrever workflows em YAML"
description: "Como eu me frustrei tanto com GitHub Actions que acabei criando meu próprio executor de comandos."
date: "2026-10-19"
translationKey: "stop-writing-workflows-in-yaml"
locale: "pt-BR"
tags: [nix, rust, now]
---

<div class="crt-splash">
<pre aria-hidden="true"> .—————————————————————————————————————————————.
|     ___________                               |
|    / _________ \       _ __   _____      __   |
|   / /   _____ \ \     | '_ \ / _ \ \ /\ / /   |
|  | |   |_    | | |    | | | | (_) \ V  V /    |
|   \ \___/ /|_| | |    |_| |_|\___/ \_/\_/     |
|    \_____/    /_/                             |
 \_____________________________________________/</pre>
</div>

> Nota: `now` inclui algumas contribuições de LLMs, todas elas revisadas com cuidado por um humano.

Se você já teve que lidar com GitHub Actions, você provavelmente esteve na mesma situação que eu. Você escreve (ou, muito provavelmente, copia e ajusta) um _workflow_, faz o _push_ da _branch_ e torce que tudo rode como esperado. Se você tiver sorte, você vai pegar um erro fácil de corrigir, como uma variável faltante no seu ambiente. Senão... lá se vai o resto do seu dia útil.

O simples fato de termos máquinas de CI gratuitas para uso livre foi uma grande bênção para vários projetos de código aberto, mas não tem nada mais doloroso do que o ciclo de iteração lento para conseguir fazer tudo funcionar da maneira exata. Entre as principais reclamações, a falta de ferramentas para validar _workflows_ localmente ou como você é [propenso a ataques de _supply chain_ por ações maliciosas](https://cybersecuritynews.com/ghostaction-supply-chain-campaign/) são algumas das comumente levantadas.

Mas minha maior queixa com as GitHub Actions seria o fato de que você as declara em YAML puro.

## Uma DSL feita às coxas

YAML se apresenta como uma linguagem de serialização amigável a humanos, mas minha experiência é longe disso. Comparada a TOML (que é mais adequada a arquivos de configuração) e JSON (para dados consumidos por sistemas), qualquer arquivo YAML de tamanho razoável rapidamente se torna uma bagunça de tipos de dado mistos sensível a espaços, sem quaisquer parênteses coloridos da sua IDE para se localizar.

Mesmo que o formato fosse decente o bastante para não confundir strings com outros tipos, ele realmente não foi feito com algo como _workflows_ das GitHub Actions em mente. Elas forçam o formato aos seus limites com condições, variáveis matriciais e comunicação entre tarefas, sem falar de um sistema de permissionamento que permite tudo por padrão, ou das várias armadilhas que você só descobre usando um linter decente como [Zizmor](https://zizmor.sh/) &ndash; que pelo menos tem o bom senso de pensar no uso local antes de tudo.

Adicione a isso que a maneira de criar suas próprias ações na prática é colando vários blocos de código _shell_ juntos no YAML, ou de forma imperativa com Node.JS, e você acaba de obter um sistema complexo, feito a partir de blocos opacos abstraindo o que não deveria ultrapassar dois ou três linhas de CLI.

Eu me frustrei tantas vezes que acabei pensando que "deve ter uma maneira melhor de fazer isso". E como eu já estava inteirado a fundo em Nix, eu decidi conectar essa ferramenta ao meu problema e formular uma solução.

## now sei o que vem agora

Inicialmente, decidi atacar algumas dessas questões: o fato de que _workflows_ não usam uma linguagem de programação real e de que não é possível rodá-los localmente. Adicione a isso o superpoder de Nix em criar ambientes reproduzíveis com uma pitada da estrutura de três camadas das GitHub Actions (_workflows_, tarefas e passos), e você [acaba criando `now`](https://now.dev.br).

![Logo do now, com uma seta espiral apontando para o centro e a palavra "now", ambas impressas num sticker gasto.](/images/posts/stop-writing-workflows-in-yaml/now.png)

Embora tenha sido criado originalmente como um executor de CI alternativo &ndash; com funcionalidades como uso de executores Nix remotos, diferente estratégias de _checkout_ e manuseio de segredos &ndash;, `now` é igualmente poderoso quando utilizado como um executor de comandos local. Parseando entradas em Nix e deixando toda a orquestração para o cópdigo em Rust (com Zig no meio para scripts pequenos sem dependências), ele possibilita definir _workflows_ _local-first_ que podem rodar em qualquer lugar em que você pode instalar Nix.

## Um exemplo completo

Aqui está um gostinho do que um _workflow_ `now.nix` complexo parece:

```nix title="now.nix"
{ runner, ... }: {
  # `now run` sem argumentos irá rodar esta tarefa por padrão
  default = [ "push-docker" ];

  # Nós declaramos cada tarefa como atributos de `jobs`
  jobs = {
    build-docker =
      # Nós podemos especificar vários construtores/executores com `runner.matrix`
      runner.matrix
        [
          {
            # Rode num sistema Linux x86_64 com Docker
            pkgs = import <nixpkgs> { system = "x86_64-linux"; };
            requiredSystemFeatures = [ "docker" ];
          }
          {
            # Também rode num sistema Linux aarch64 com Docker
            pkgs = import <nixpkgs> { system = "aarch64-linux"; };
            requiredSystemFeatures = [ "docker" ];
          }
        ]
        (
          # Cada executor ganha uma instância de `nixpkgs` apropriada
          { pkgs, ... }: {
            name = "Build Docker (${pkgs.stdenv.hostPlatform.system})";
            steps = [
              # Nós podemos fazer upload de derivações Nix ao orquestrador
              # (incluindo de imagens Docker construídas com `dockerTools`)
              (runner.steps.upload {
                name = "docker-${pkgs.stdenv.hostPlatform.system}";
                deriv = pkgs.dockerTools.buildLayeredImage {
                  name = "hello";
                  tag = "latest";
                  config.Entrypoint = [ (lib.getExe pkgs.hello) ];
                };
              })
            ];
          }
        );

    push-docker = { pkgs, ... }: {
      name = "Push Docker";
      # Declare uma dependência explícita entre tarefas
      needs = [ "build-docker" ];
      steps = [
        {
          name = "Log in to DockerHub";
          env = {
            DOCKERHUB_PUSH_TOKEN = runner.secret "DOCKERHUB_PUSH_TOKEN";
            DOCKERHUB_USERNAME = runner.var "DOCKERHUB_USERNAME";
          };
          path = [ pkgs.docker ];
          # Entre no Docker Hub com nossas credenciais e saia ao terminar
          run = ''
            echo "$DOCKERHUB_PUSH_TOKEN" | docker login \
              --password-stdin --username $DOCKERHUB_USERNAME docker.io
          '';
          teardown = ''
            docker logout docker.io
          '';
        }
        {
          name = "Log in to GHCR";
          env = {
            GITHUB_TOKEN = runner.secret "GITHUB_TOKEN";
            GITHUB_USERNAME = runner.var "GITHUB_USERNAME";
          };
          path = [ pkgs.docker ];
          # Entre no GHCR com nossas outras credenciais
          run = ''
            echo "$GITHUB_TOKEN" | docker login \
              --password-stdin --username $GITHUB_USERNAME ghcr.io
          '';
          teardown = ''
            docker logout ghcr.io
          '';
        }
        {
          name = "Push images";
          env = {
            # Nós podemos criar Docker tags separadas por espaço com Nix
            TAGS = builtins.concatStringsSep " " (
              map ({ image, tag }: "${image}:${tag}") (
                lib.cartesianProduct {
                  image = [
                    "docker.io/${runner.var "DOCKERHUB_USERNAME"}/hello"
                    "ghcr.io/${runner.var "GITHUB_USERNAME"}/hello"
                  ];
                  tag = [
                    "latest"
                    "main"
                  ];
                }
              )
            );
            AMD_IMAGE = runner.download "docker-x86_64-linux";
            ARM_IMAGE = runner.download "docker-aarch64-linux";
          };
          # Declare todas as dependências para esse passo
          path = [
            pkgs.docker
            pkgs.docker-buildx
            pkgs.skopeo
          ];
          run = ''
            for TAG in $TAGS; do
              skopeo copy docker-archive:$AMD_IMAGE "docker://$TAG-amd64"
              skopeo copy docker-archive:$ARM_IMAGE "docker://$TAG-arm64"
              docker buildx imagetools create \
                --tag "$TAG" "$TAG-amd64" "$TAG-arm64"
            done
          '';
        }
      ];
    };
  };
}
```

Se você tem familiaridade com [a linguagem Nix](https://nixos.org/), o código acima deve ser intuitivo, embora seja convoluto. Nós declaramos duas tarefas, `build-docker` e `push-docker`, com uma dependência explícita entre elas via `needs = [ "build-docker" ]`. A primeira cria uma imagem Docker (como uma derivação Nix, é claro) em ambas x86_64 e aarch64, enquanto a segunda se loga nos _registries_ de Docker e faz _push_ das nossas imagens.

Algumas diferenças das GitHub Actions que chamam a atenção:

- Especificar _workers_ de arquiteturas diferentes é tão simples quanto instanciar `nixpkgs` para cada um. Além disso, nós podemos definir `requiredSystemFeatures` para apenas utilizar hosts que disponibilizam um _daemon_ Docker.
- `runner.steps.upload` constrói e compartilha nossas imagens Docker, que podemos resgatar depois com `runner.download`.
- Nós declaramos nossas variáveis de ambientes e pacotes em cada passo. Um passo pode receber `pkgs.docker` e uma variável secreta, enquanto que o próximo pode apenas utilizar `pkgs.skopeo`. Isso é similar a criar _shells_ de desenvolvimento para cada passo, com segredos sendo compartilhados apenas aonde são declarados.
- Nós podemos usar programação funcional de verdade! Isso permite que realizemos todo tipo de operação nós mesmos ao invés de depender de ações externas.
- Limpeza de ambiente é uma funcionalidade de primeira classe via _scripts_ `teardown`.

O modelo de mundo do Nix se encaixa perfeitamente no caso de uso de CI declarativo. Toda a comunicação ocorre através da camada de orquestração ou pelo Nix _store_, via derivações. E tudo o que você precisa para rodar executores remotos é uma conexão SSH a uma máquina rodando Nix.

## Now para sempre

Isso é apenas a superfície; `now` está cheio de funcionalidades úteis. Aqui estão algumas:

- Ao invés de depender exclusivamente de bash, você pode especificar scripts em [qualquer _shell_ que você quiser](https://now.dev.br/options/#stepshell), seja `nushell` ou `python3` ou até mesmo `rust-script`!
- [_Sandboxing_](https://now.dev.br/configuration/#sandboxing) permite que você rode passos com permissões restritas e granulares, tanto em Linux quanto macOS.
- Você pode usar [estratégias de _checkout_ diferentes](https://now.dev.br/configuration/#checkout) dependendo de se o diretório atual deve ser copiado para executores remotos ou não.
- Priorizando o uso local, `now` tem [múltiplas maneiras de verificar seu _workflow_](https://now.dev.br/writing-your-own-jobs/#checking-your-workflow) antes de você ter que rodar qualquer coisa.
- [Com suporte a _shebang_](https://now.dev.br/configuration/#shebang-support), você pode distribuir _workflows_ rodáveis como um único arquivo `now.nix`.
- Como um executor de comandos poderoso e extensível, ele inclusive tem suporte a rodar dependências de desenvolvimento como PostgreSQL [com seu _add-on_ de serviços](https://now.dev.br/services/).
- Você pode facilmente invocar `now` [nas suas GitHub Actions](https://now.dev.br/cookbook/#using-in-github-actions), tornando trivial de ligar no seu CI atual.

Uma ressalva é de que `now` dependende de um modelo "traga suas próprias máquinas", necessitando de uma conexão SSH a elas &ndash; o que não condiz muito com o modelo de executores das GitHub Actions. Isso quer dizer que ele não é um substituto um-pra-um delas (~~a não ser que você descubra como integrá-lo com o [upterm](https://github.com/owenthereal/action-upterm/); nesse caso, me avise!~~ embora você consiga resultados bem decentes com [Tailscale SSH](https://now.dev.br/cookbook/#__tabbed_1_2) às custas de ergonomia). Mas para meus casos de uso, é mais do que o bastante para preencher as lacunas que as GHA criam.

Apesar dos tempos de inicialização lentos devidos a avaliação do Nix e construção de derivações, ele acaba também sendo um bom substituto para ferramentas como [`just`](https://github.com/casey/just), em especial quando você precisa de várias ferramentas em uma versão específica e reproduzível. Aqui estão algumas das coisas para as quais eu uso o `now`:

- Configurar repositórios.
- Fazer _deploy_ de websites construídos com Nix a servidores.
- Rodar a própria suíte de testes do `now`.
- Tarefas de formatação, _linting_ e testes do [Sandhole](https://codeberg.org/sandhole/sandhole/src/branch/main/now.nix).
- Fazer _push_ de imagens Docker _cross-compiled_ a um Raspberry Pi.
- Criar AppImages em [um ambiente compatível com FHS](https://now.dev.br/cookbook/#running-steps-in-an-fhs-compatible-environment).

`now` está [disponível sob a licença AGPL-3.0](https://codeberg.org/now-runner/now/). Se ele soa como algo que pode resolver um dos problemas que você tem com GitHub Actions ou outros executores de comandos, [leia a documentação](https://now.dev.br/) e experimente!<span class="cursor">█</span>

---

_Precisa de ajuda? [Dê um "alô" no Mastodon](https://mastodon.xyz/@epiceric) ou [me mande um e-mail](mailto:now@eric.dev.br)._
