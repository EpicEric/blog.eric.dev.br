+++
title = "Hospedando Forgejo com Sandhole"
authors = ["Eric Rodrigues Pires"]
description = "Um guia sobre como usar o Sandhole para qualquer fim, para expor um serviço à Internet."
date = 2026-01-22
# updated = 2024-06-21
taxonomies.tags = ["Sandhole", "hospedagem"]
+++

<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>

{% crt() %}

```
                      .-o
__  _/\/\/\_  __     /
\ )_\ o  o /_( /  &  |--o
/_)\____w___/(_\     |
     n    n          o
```

{% end %}

<div x-data="{ ipv4: '<ENDEREÇO IPv4>', ipv6: '<ENDEREÇO IPv6>', domain: 'sandhole.example', email: 'admin@your.email', getIpv4() { return this.ipv4.trim() || '<ENDEREÇO IPv4>'; }, getIpv6() { return this.ipv6.trim() || '<ENDEREÇO IPv6>'; }, getDomain() { return this.domain.trim() || 'sandhole.example'; }, getEmail() { return this.email.trim() || 'admin@your.email'; } }">

Às vezes, você só quer hospedar os serviços que você usa. Talvez você esteja preocupado com a segurança dos seus dados, ou você discorda das ações ou Termos de Uso de um dos seus serviços atuais, ou você tem um drive de 1 Terabyte em desuso que seria muito caro para usar na nuvem... ou talvez um novo repositório open-source chamou sua atenção, e você quer experimentar com ele.

Graças a Docker/Podman, NixOS, ou até mesmo K3s, subir um serviço em um servidor caseiro é tranquilo &ndash; mas e se você gostaria que ele estivesse disponível para além da rede local? Daí você precisaria de um IP público, que seu provedor de Internet quase certamente não providenciará, e o IPv6 ainda não é tão universal quanto deveria ser.

Felizmente, você consegue comprar uma VPS barata com um endereço IP público com extrema facilidade nos dias de hoje (de provedores cloud como Hetzner ou DigitalOcean, ou Magalu Cloud se você estiver no Brasil como eu), mas você estará sujeito a armazenar seus dados externamente e limitado de recursos computacionais. Se você quiser combinar o melhor de dois mundos &ndash; um IP público com controle total sobre o seu serviço &ndash;, então o [Sandhole](https://sandhole.com.br) pode ser exatamente o que você precisa.

![O logo do Sandhole, com Ferris aparecendo de um buraco de areia e o nome "Sandhole" escrito em letra cursiva ao lado.](../sandhole.png)

Assim como ngrok ou Tailscale Funnel, Sandhole é um proxy reverso que expõe servidores atrás de CGNAT à Internet &ndash; conseguindo essa proeza através de funcionalidades do OpenSSH, como redirecionamento remoto (_remote forwarding_). A autenticação é tão simples quanto utilizar chaves SSH e o redirecionamento de portas funciona independentemente da topologia da sua rede; tudo que você precisa para usar uma instância do Sandhole é conseguir alcançá-la pela rede!

_Diferentemente_ destas ferramentas, Sandhole é [completamente open-source](https://github.com/EpicEric/sandhole), sendo que auto-hospedagem é o seu principal caso de uso. Escrito em Rust, ele é distribuído como um único arquivo binário que roda em qualquer lugar (até mesmo no Windows!), e pode facilmente lidar com várias conexões simultâneas sem consumir muita CPU ou RAM.

Neste guia, vamos configurar nossa pŕopria forja de código (_Git forge_), criar nossa instância do Sandhole para expô-la ao mundo, e ver quais desafios podemos encontrar no caminho.

## Requisitos

Você precisará dos seguintes itens para seguir este guia (edite os campos com os seus dados):

1. Um endereço de e-mail para gerar certificados do Let's Encrypt (indicado como <input type="text" x-model="email" placeholder="admin@your.email" value="admin@your.email" />).

2. Um servidor com um endereço IPv4 público para rodar o Sandhole (indicado como <input type="text" x-model="ipv4" placeholder="<ENDEREÇO IPv4>" value="<ENDEREÇO IPv4>" />). Opcionalmente &ndash; ou alternativamente &ndash;, você também pode utilizar um endereço IPv6 (indicado como <input type="text" x-model="ipv6" placeholder="<ENDEREÇO IPv6>" value="<ENDEREÇO IPv6>" />).

3. Um servidor doméstico conectado à Internet.

4. Um nome de domínio, mais seus subdomínios, apontando para o IP público em (2) (indicado como <input type="text" x-model="domain" placeholder="sandhole.example" value="sandhole.example" />).

Embora (1) e (2) sejam obrigatórios, você pode até se virar sem os outros dois itens. Por exemplo, (3) poderia muito bem ser o mesmo servidor que (2). Mas não usar (4) é complicado &ndash; ele requer que você use um serviço como [sslip.io](https://sslip.io), o que involve muitos detalhes técnicos que estão fora do escopo deste guia simplificado.

Porém, (2) e (4) não precisam ser de um servidor que seja seu! Ele pode pertencer a uma instância do Sandhole administrada por outra pessoa, como uma amiga de confiança.

Para fins de demonstração, já que o nosso domínio será <code><span x-text="getDomain()">sandhole.example</span></code>, vamos rodar nosso servidor auto-hospedado no subdomínio <code>git.<span x-text="getDomain()">sandhole.example</span></code>.

A configuração mínima do nosso DNS será algo como:

| Tipo |                              Registro                               |                         Valor                         |
| :--: | :-----------------------------------------------------------------: | :---------------------------------------------------: |
|  A   |         <span x-text="getDomain()">sandhole.example</span>          | <span x-text="getIpv4()">&lt;ENDEREÇO IPv4&gt;</span> |
|  A   |        \*.<span x-text="getDomain()">sandhole.example</span>        | <span x-text="getIpv4()">&lt;ENDEREÇO IPv4&gt;</span> |
| AAAA |         <span x-text="getDomain()">sandhole.example</span>          | <span x-text="getIpv6()">&lt;ENDEREÇO IPv6&gt;</span> |
| AAAA |        \*.<span x-text="getDomain()">sandhole.example</span>        | <span x-text="getIpv6()">&lt;ENDEREÇO IPv6&gt;</span> |
|  NS  | \_acme-challenge.<span x-text="getDomain()">sandhole.example</span> |  <span x-text="getDomain()">sandhole.example</span>   |

## Forgejo

Nós iremos configurar uma instância do [Forgejo](https://forgejo.org/), com uma interface web e porta SSH (para tornar os pulls/pushes ergonômicos).

Eu vou usar o NixOS como exemplo, já que é minha obsessão atual, mas também por questão de brevidade. [Outros métodos de instalação](https://forgejo.org/docs/latest/admin/installation/) funcionarão da mesma maneira.

<div x-data="{ html: '' }" x-init="html = $el.innerHTML.replaceAll('sandhole.example', '<span x-text=\'getDomain()\'>sandhole.example</span>')" x-html="html">

```nix,name=configuration.nix
{ ... }:
{
  # ...

  services.forgejo = {
    enable = true;
    database.type = "postgres";
    settings = {
      server = {
        HTTP_ADDR = "::";
        HTTP_PORT = 3000;
        ROOT_URL = "https://git.sandhole.example:443/";
        LOCAL_ROOT_URL = "https://git.sandhole.example:443/";
        SSH_PORT = 22;
        SSH_LISTEN_PORT = 2222;
        START_SSH_SERVER = true;
        SSH_DOMAIN = "git.sandhole.example";
      };
      service = {
        DISABLE_REGISTRATION = true;
        REQUIRE_SIGNIN_VIEW = false;
      };
      repository = {
        DISABLE_STARS = true;
        MAX_CREATION_LIMIT = 0;
      };
    };
  };

  networking.firewall.allowedTCPPorts = [
    3000
    2222
  ];
}
```

</div>

Aqui, nós usamos o nosso subdomínio especial, mas ainda podemos acessar a instância do Forgejo em `localhost:3000`. Você pode temporariamente definir `serives.forgejo.settings.service.DISABLE_REGISTRATION` como _false_ para criar a conta de administrador, mas essa será toda a configuração do Forgejo que faremos no momento.

Note que estamos definindo portas de produção para os endpoints voltados a usuários: 443 para HTTPS e 22 para SSH. É aqui que o Sandhole entra para nos ajudar &ndash; mesmo que ninguém mais possa acessar nosso servidor no momento.

## Sandhole

Como mencionei anteriormente, vamos configurar o Sandhole numa VPS com IP público. Há [múltiplas maneiras](https://sandhole.com.br/quick_start.html) de configurá-lo, mas vamos seguir com Docker Compose para fins de simplicidade.

Após alugar um novo servidor, algo que você talvez queira fazer é trocar a porta do servidor OpenSSH para 2222, de tal forma que os usuários do Forgejo consigam se conectar pela porta 22 (que será gerenciada pelo Sandhole). Se você quiser fazer isso, então:

1. Habilite conexões de entrada pela porta TCP 2222 no firewall (se você tiver um);
2. Adicione a linha `Port 2222` ao arquivo `/etc/ssh/sshd_config`;
3. Reinicie o daemon do SSH; e
4. Certifique-se de que você consegue se conectar ao servidor na nova porta de outro terminal &ndash; caso contrário, você perderá o acesso à VPS ao se deslogar.

Agora, vamos subir nossa instância do Sandhole. Primeiro, iremos configurar o Agnos &ndash; um serviço que irá gerar os certificados _wildcard_ para nosso domínio e subdomínios. Você lembra quando criamos um registro `NS` apontando para o próprio servidor mais cedo? O Agnos é o motivo! Enfim, ele espera um arquivo de configuração `config.toml`:

<div x-data="{ html: '' }" x-init="html = $el.innerHTML.replaceAll('sandhole.example', '<span x-text=\'getDomain()\'>sandhole.example</span>').replaceAll('admin@your.email', '<span x-text=\'getEmail()\'>admin@your.email</span>')" x-html="html">

```toml,name=config.toml
dns_listen_addr = "[::]:53"

[[accounts]]
email = "admin@your.email"
private_key_path = "agnos/letsencrypt_key.pem"

[[accounts.certificates]]
domains = ["sandhole.example", "*.sandhole.example"]
fullchain_output_file = "agnos/sandhole.example/fullchain.pem"
key_output_file = "agnos/sandhole.example/privkey.pem"
reuse_private_key = true
```

</div>

E aqui está nossa configuração do Docker Compose:

<div x-data="{ html: '' }" x-init="html = $el.innerHTML.replaceAll('sandhole.example', '<span x-text=\'getDomain()\'>sandhole.example</span>').replaceAll('admin@your.email', '<span x-text=\'getEmail()\'>admin@your.email</span>')" x-html="html">

```yaml,name=compose.yaml
    container_name: sandhole_agnos
    restart: unless-stopped
    ports:
      - "53:53/udp"
    volumes:
      - ./agnos:/agnos:rw
      - ./config.toml:/config.toml:ro
    command:
      - sh
      - -c
      - >
        agnos-generate-accounts-keys --key-size 4096
           --no-confirm config.toml
        && agnos --no-staging config.toml
        && echo 'Retrying in one hour...'
        && sleep 3600

  sandhole:
    image: docker.io/epiceric/sandhole:latest
    container_name: sandhole
    restart: unless-stopped
    volumes:
      - ./deploy:/deploy:rw
      - ./agnos:/agnos:ro
    network_mode: host
    command: |
      --domain=sandhole.example
      --acme-contact-email=admin@your.email
      --user-keys-directory=/deploy/user_keys/
      --admin-keys-directory=/deploy/admin_keys/
      --certificates-directory=/agnos/
      --acme-cache-directory=/deploy/acme_cache/
      --private-key-file=/deploy/server_keys/ssh
      --ssh-port=22
      --http-port=80
      --https-port=443
      --allow-requested-subdomains
      --force-https
      --connect-ssh-on-https-port
```

</div>

Finalmente, temos o Sandhole rodando em um servidor! Se você abriu todas as portas necesssárias no firewall, incluindo a porta `53/udp` do Agnos, ele deveria funcionar sem mais ajustes. Mesmo assim, o Sandhole não é útil até que conectemos nosso servidor nele, então vamos fazer isso agora.

## Proxy reverso

O propósito do Sandhole é facilitar o processo de expor serviços à Internet de forma segura. Nós vamos precisar de uma chave SSH, já que é isso que o Sandhole usa para autenticação, e vamos dar um nome e comentário a ela que identifique o seu propósito.

<div x-data="{ html: '' }" x-init="html = $el.innerHTML.replaceAll('sandhole.example', '<span x-text=\'getDomain()\'>sandhole.example</span>')" x-html="html">

```bash
ssh-keygen -t ed25519 -f ~/.ssh/git.sandhole.example -C "git.sandhole.example"
```

</div>

Isto gerará dois arquivos em `~/ssh`, mas só estamos interessados em <code>git.<span x-text="getDomain()">sandhole.example</span>.pub</code> (a chave pública) no momento.

De volta ao servidor do Sandhole, na raiz do nosso Docker Compose, adicione uma cópia da chave <code>git.<span x-text="getDomain()">sandhole.example</span>.pub</code> a `./deploy/user_keys/`. Quaisquer chaves neste diretório (que foi definido por `--user-keys-directory`) são autorizadas a fazer proxy de serviços.

Vamos usar autossh no servidor doméstico rodando Forgejo, para manter uma conexão persistente dele ao Sandhole. Para o nosso exemplo do NixOS, isso é tão simples quanto adicionar uma configuração nova em `services.autossh.sessions` (com o caminho correto para nossa chave SSH privada):

<div x-data="{ html: '' }" x-init="html = $el.innerHTML.replaceAll('sandhole.example', '<span x-text=\'getDomain()\'>sandhole.example</span>')" x-html="html">

```nix,name=configuration.nix
{ ... }:
{
  # ...

  services.autossh.sessions = [
    {
      name = "forgejo";
      user = "root";
      extraArguments = ''
        -i /home/eu/.ssh/git.sandhole.example \
        -o StrictHostKeyChecking=accept-new \
        -o ServerAliveInterval=30 \
        -R git.sandhole.example:80:localhost:3000 \
        -R git.sandhole.example:22:localhost:2222 \
        sandhole.example
      '';
    }
  ];
}
```

</div>

Como alternativa, você pode usar o Docker Compose com a imagem `epiceric/sandhole-client`, [tal como este exemplo](https://github.com/EpicEric/sandhole/blob/main/docker-compose-example/client/compose.yml).

Se a conexão falhar por conexões de saída na porta SSH serem barradas, tente adicionar `-p 443` aos argumentos de linha de comando do autossh. Já que configuramos `--connect-ssh-on-https-port` no Sandhole mais cedo, nós podemos conectar com SSH à porta HTTPS do nosso servidor!

Agora, quando você acessar <code>https://git.<span x-text="getDomain()">sandhole.example</span></code>, sua instância do Forgejo deverá aparecer magicamente, com um certificado TLS e tudo o mais!

## ProxyJump

Tem apenas mais um detalhe com o qual precisamos nos preocupar.

Se você tentar clonar ou fazer push de um repo via SSH, você irá receber um erro críptico:

```txt
exec request failed on channel 0
fatal: Could not read from remote repository.

Please make sure you have the correct access rights
and the repository exists.
```

A razão é que, embora o host SSH <code>git.<span x-text="getDomain()">sandhole.example</span></code> aponte para o Sandhole, não tem nada que diga que ele use o nosso serviço SSH atrás da proxy &ndash; em outras palavras, o Sandhole está sendo considerado como nosso servidor SSH do Forgejo! Enquanto que o protocolo HTTP tem um [cabeçalho `Host`](https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Reference/Headers/Host) para fazer _multiplexing_ de vários servidores HTTP ao mesmo tempo, não tem nada parecido com isso no SSH; então nós iremos manualmente especificar para qual "host virtual" nós queremos "pular", com a seguinte configuração no arquivo `~/.ssh/config`:

<div x-data="{ html: '' }" x-init="html = $el.innerHTML.replaceAll('sandhole.example', '<span x-text=\'getDomain()\'>sandhole.example</span>')" x-html="html">

```ssh-config,name=~/.ssh/config
Host git.sandhole.example
	IdentityFile ~/.ssh/id_ed25519
	IdentitiesOnly yes
	ProxyJump sandhole.example
```

</div>

A parte importante é o `ProxyJump`. Ele diz para o SSH fazer proxy da conexão a <code>git.<span x-text="getDomain()">sandhole.example</span></code> através do servidor SSH real, <code><span x-text="getDomain()">sandhole.example</span></code>. Normalmente, você usaria isso para alcançar um host real dentro de uma VPN, mas no nosso caso, o Sandhole usa magia de _aliasing_ para redirecionar conexões ao serviço apropriado nos hosts virtuais do seu proxy.

Você precisará instruir quaisquer usuários da sua instância do Forgejo a fazer o mesmo, mas depois de configurar o `ProxyJump`, você pode esquecer completamente que ele existe.

## Próximos passos

E isso é tudo! Nossa instância do Forgejo está completamente operacional e exposta via Sandhole. Claro, isso é só o começo, e você pode [mexer com as opções do Sandhole](https://sandhole.com.br) ou expor ainda mais serviços TCP que seriam inviáveis só com nossa LAN. Você pode rodar um blog estático, [um gerenciador de senhas](https://github.com/dani-garcia/vaultwarden), ou um servidor de Minecraft... só se lembre de seguir as boas práticas de segurança ao longo do caminho!

Sério, auto-hospedagem pode ser bem viciante, e o Sandhole com certeza alimenta esses impulsos.<span class="cursor">█</span>

</div>

---

_Precisa de ajuda? [Me mande uma mensagem no Mastodon](https://mastodon.xyz/@epiceric) ou [envie um e-mail](mailto:sandhole@eric.dev.br)._
