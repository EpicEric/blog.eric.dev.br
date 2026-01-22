+++
title = "Self-hosting Forgejo with Sandhole"
authors = ["Eric Rodrigues Pires"]
description = "A guide on using Sandhole for fun and profit, and getting a local service exposed to the wide web."
date = 2026-01-22
# updated = 2024-06-21
taxonomies.tags = ["Rust", "Sandhole", "self-hosting"]
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

<div x-data="{ ipv4: '<IPv4 ADDRESS>', ipv6: '<IPv6 ADDRESS>', domain: 'sandhole.example', email: 'admin@your.email', getIpv4() { return this.ipv4.trim() || '<IPv4 ADDRESS>'; }, getIpv6() { return this.ipv6.trim() || '<IPv6 ADDRESS>'; }, getDomain() { return this.domain.trim() || 'sandhole.example'; }, getEmail() { return this.email.trim() || 'admin@your.email'; } }">

Sometimes, you just want to host your services yourself. Maybe you're worried about securing your data, or you disagree with the actions or Terms of Service of existing service providers, or you want to make use of a 1 Terabyte drive that you have lying around that'd cost too much on the cloud... or a fancy new open-source repo called your attention, and you wanna take it for a spin.

With the help of Docker/Podman, NixOS, or even K3s, getting your service started on a home server is easy enough &ndash; but what if you'd like to make it accessible outside of your network? Then you'd need a public IP, which your Internet provider is very unlikely to provide, and IPv6 still isn't as universal as it should be.

Thankfully, you can get a cheap VPS with a public IP address pretty easily nowadays (from clouds such as Hetzner, or DigitalOcean, or Magalu Cloud if you're in Brazil like me), but then you're reliant on external storage and limited computing resources. If you want to combine the best of both worlds &ndash; a public IP with full control of your service &ndash;, then [Sandhole](https://sandhole.com.br) might be just what you need.

![The Sandhole logo, with Ferris partially inside a sandhole and the name "Sandhole" written in cursive beside them.](./sandhole.png)

Like ngrok or Tailscale Funnel, Sandhole is a reverse proxy that exposes servers behind CGNAT to the wider web &ndash; but it does so with clever functionalities from OpenSSH, such as remote forwarding. Authentication is as simple as using SSH keys, and port forwarding works no matter your network topology; all that you need to use a Sandhole instance is to be able to reach it over the Internet!

_Unlike_ those tools, Sandhole is [completely open-source](https://github.com/EpicEric/sandhole), with self-hosting as its main use-case. Being written in Rust, it comes as a single binary that runs anywhere (even on Windows!), and can easily handle several connections without consuming a lot of CPU or RAM.

In this guide, we'll go through setting up our own Git forge, creating our Sandhole instance to expose it to the world, and any challenges that we might face along the way.

## Requirements

You'll need these in order to follow this guide (edit the fields with your info):

1. An e-mail address for generating Let's Encrypt certificates (denoted as <input type="text" x-model="email" placeholder="admin@your.email" value="admin@your.email" />).

2. A server with a public IPv4 address to run Sandhole on (denoted as <input type="text" x-model="ipv4" placeholder="<IPv4 ADDRESS>" value="<IPv4 ADDRESS>" />). Optionally &ndash; or alternatively &ndash;, you can also use an IPv6 address (denoted as <input type="text" x-model="ipv6" placeholder="<IPv6 ADDRESS>" value="<IPv6 ADDRESS>" />).

3. A home server with an Internet connection.

4. A domain name, and its subdomains, all pointed to the public IP in (2) (denoted as <input type="text" x-model="domain" placeholder="sandhole.example" value="sandhole.example" />).

While (1) and (2) are mandatory, you can kind of work around the other two. For example, (3) could very well be the same server as (2). But not using (4) is tricky &ndash; it requires using a service like [sslip.io](https://sslip.io), which involves a lot of technical details, which are outside of the scope of this simple guide.

However, (2) and (4) don't have to be from a server that you own! It could belong to an instance of Sandhole managed by someone else, like a friend that you trust.

For the purposes of demonstration, since our main domain will be <code><span x-text="getDomain()">sandhole.example</span></code>, let's run our self-hosted server under the subdomain <code>git.<span x-text="getDomain()">sandhole.example</span></code>.

Our minimal DNS setup might look like:

| Type |                               Record                                |                        Value                         |
| :--: | :-----------------------------------------------------------------: | :--------------------------------------------------: |
|  A   |         <span x-text="getDomain()">sandhole.example</span>          | <span x-text="getIpv4()">&lt;IPv4 ADDRESS&gt;</span> |
|  A   |        \*.<span x-text="getDomain()">sandhole.example</span>        | <span x-text="getIpv4()">&lt;IPv4 ADDRESS&gt;</span> |
| AAAA |         <span x-text="getDomain()">sandhole.example</span>          | <span x-text="getIpv6()">&lt;IPv6 ADDRESS&gt;</span> |
| AAAA |        \*.<span x-text="getDomain()">sandhole.example</span>        | <span x-text="getIpv6()">&lt;IPv6 ADDRESS&gt;</span> |
|  NS  | \_acme-challenge.<span x-text="getDomain()">sandhole.example</span> |  <span x-text="getDomain()">sandhole.example</span>  |

## Forgejo

We'll be setting up a [Forgejo](https://forgejo.org/) instance, with a web interface and an SSH port (for ergonomic pulls/pushes).

I'll be using NixOS as an example, since that's my current fixation, but also for brevity's sake. [Other installation methods](https://forgejo.org/docs/latest/admin/installation/) will work just as well.

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

We're using our special subdomain here, but that doesn't stop us from accessing the instance at `localhost:3000`. You can temporarily set `serives.forgejo.settings.service.DISABLE_REGISTRATION` to _false_ in order to create the admin account, and that's all the configuration we'll be doing for now.

You'll also notice that we're choosing production ports for the user-facing endpoints: 443 for HTTPS, and 22 for SSH. That's where Sandhole will help us &ndash; even though nobody else can reach our server at the moment.

## Sandhole

As mentioned previously, we'll set up Sandhole on a VPS with a public IP. There are [multiple ways](https://sandhole.com.br/quick_start.html) to get started, but we'll just stick with Docker Compose for simplicity.

After renting a server, one thing that you might be interested in is changing the OpenSSH port to something like 2222, so that our Forgejo users can connect to port 22 instead (which will be managed by Sandhole). If this sounds desirable, then make sure to:

1. Enable incoming connections on the TCP port 2222 in your firewall (if you have one);
2. Edit `/etc/ssh/sshd_config` with the line `Port 2222`;
3. Restart your SSH daemon; and
4. Make sure that you can connect from another terminal to your server at the new port &ndash; otherwise, you'll be locked out of your VPS.

Now, let's get our Sandhole instance running with our domain. First, we'll configure Agnos &ndash; a service that'll be in charge of generating our wildcard certificates. Remember how we've set an `NS` record pointing to our own server earlier? Agnos is the reason why! Anyway, we need to feed it a `config.toml`:

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

And here's our Docker Compose configuration:

<div x-data="{ html: '' }" x-init="html = $el.innerHTML.replaceAll('sandhole.example', '<span x-text=\'getDomain()\'>sandhole.example</span>').replaceAll('admin@your.email', '<span x-text=\'getEmail()\'>admin@your.email</span>')" x-html="html">

```yaml,name=compose.yaml
services:
  agnos:
    image: docker.io/epiceric/agnos:latest
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

Finally, we've got Sandhole up and running! As long as you've made sure to open any required firewall ports, including Agnos's `53/udp`, it should just work out of the box. Even so, Sandhole won't do anything useful until we connect to it from our server, so let's tackle that now.

## Reverse proxy

The whole point of using Sandhole is to make it easier to safely expose services to the Internet. We'll need an SSH key, since that's what Sandhole uses for authenticating users, and we'll give it a name and comment that identify its purpose.

<div x-data="{ html: '' }" x-init="html = $el.innerHTML.replaceAll('sandhole.example', '<span x-text=\'getDomain()\'>sandhole.example</span>')" x-html="html">

```bash
ssh-keygen -t ed25519 -f ~/.ssh/git.sandhole.example -C "git.sandhole.example"
```

</div>

This will generate two files inside of `~/ssh`, and we're only interested in <code>git.<span x-text="getDomain()">sandhole.example</span>.pub</code> (the public key) for now.

Back in the Sandhole server, at the root of your Docker Compose, add a copy of <code>git.<span x-text="getDomain()">sandhole.example</span>.pub</code> to `./deploy/user_keys/`. Any keys in this directory (set with `--user-keys-directory`) are authorized to proxy services.

We'll use autossh on our Forgejo-running server to keep a persistent connection to Sandhole. For our NixOS example, this is as simple as configuring an entry in `services.autossh.sessions` (with the appropriate path for the SSH private key):

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
        -i /home/me/.ssh/git.sandhole.example \
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

For a Docker Compose alternative, you can use the `epiceric/sandhole-client` image, [as seen here](https://github.com/EpicEric/sandhole/blob/main/docker-compose-example/client/compose.yml).

If the connection fails due to outbound SSH connections being blocked, try adding `-p 443` to the autossh arguments. Since we've configured `--connect-ssh-on-https-port` in Sandhole earlier, this will let us connect our SSH client via the HTTPS port!

Now, when you access <code>https://git.<span x-text="getDomain()">sandhole.example</span></code>, your Forgejo instance should magically appear, with a TLS certificate and all!

## ProxyJump

There's one other detail that we have to deal with.

If you attempt to clone or push a repo with SSH, you'll get back a cryptic error:

```txt
exec request failed on channel 0
fatal: Could not read from remote repository.

Please make sure you have the correct access rights
and the repository exists.
```

The reason is that, while the SSH host <code>git.<span x-text="getDomain()">sandhole.example</span></code> points to Sandhole as intended, there's nothing telling it to use our proxied SSH service &ndash; in other words, it's treating Sandhole as our Forgejo SSH server! While HTTP has a [`Host` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Host) for multiplexing several HTTP servers at once, with SSH, we must manually specify which "virtual host" we wish to "jump" to, by adding a simple entry to our `~/.ssh/config` file:

<div x-data="{ html: '' }" x-init="html = $el.innerHTML.replaceAll('sandhole.example', '<span x-text=\'getDomain()\'>sandhole.example</span>')" x-html="html">

```ssh-config,name=~/.ssh/config
Host git.sandhole.example
	IdentityFile ~/.ssh/id_ed25519
	IdentitiesOnly yes
	ProxyJump sandhole.example
```

</div>

The important bit is `ProxyJump`. It tells SSH to proxy our connection to <code>git.<span x-text="getDomain()">sandhole.example</span></code> via the actual SSH server, <code><span x-text="getDomain()">sandhole.example</span></code>. This is normally used to reach real hosts inside a VPN, for example, but in our case, Sandhole uses some aliasing magic to forward connections to the appropriate service on the proxied virtual hosts.

You'll have to instruct other users of your Forgejo instance to do the same, but once the `ProxyJump` is configured, it's a fire-and-forget setting.

## Next steps

And that's it! Now we have a fully operational Forgejo instance, exposed with own Sandhole. Of course, nothing stops us from [tinkering with Sandhole's options](https://sandhole.com.br), or adding even more TCP services that would otherwise only be reachable within our LAN. You could run a static blog, [a password manager](https://github.com/dani-garcia/vaultwarden), or a Minecraft server... just make sure to follow security best practices along the way!

Trust me, self-hosting can be quite addicting, and Sandhole definitely enables that urge.<span class="cursor">█</span>

</div>

---

_Need any help? [Drop a ping on Mastodon](https://mastodon.xyz/@epiceric) or [e-mail me](mailto:sandhole@eric.dev.br)._
