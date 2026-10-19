---
title: "Stop writing workflows in YAML"
description: "How I got too frustrated with GitHub Actions and ended up making my own command runner."
date: "2026-10-18"
draft: true
translationKey: "stop-writing-workflows-in-yaml"
locale: "en"
tags: [nix, rust, now]
---

<div class="crt-splash">
<pre aria-hidden="true"> .————————————————————————————————————————————.
|    ___________                               |
|   / _________ \       _ __   _____      __   |
|  / /   _____ \ \     | '_ \ / _ \ \ /\ / /   |
| | |   |_    | | |    | | | | (_) \ V  V /    |
|  \ \___/ /|_| | |    |_| |_|\___/ \_/\_/     |
|   \_____/    /_/                             |
 \____________________________________________/</pre>
</div>

If you've had to mess with GitHub Actions, you've probably been there, too. You write (or more likely, you copy-paste and adjust) a workflow, you push it to a branch, and you hope that it runs like you would expect. If you're lucky, you'll get a mistake that's easy to fix, like a missing variable in your environment. If not, well... there goes the rest of your workday.

The fact that we have free CI runners at the disposal of open-source software has been a great boom for many projects, but there's nothing quite as painful as the slow iteration cycle of getting things to work just right. Among the many usual complaints, the lack of tooling to validate workflows locally or how you're [prone to supply chain attacks from malicious actions](https://cybersecuritynews.com/ghostaction-supply-chain-campaign/) are some of the few levied against it.

But my main gripe with GitHub Actions would be the fact that you declare them in pure YAML.

## A hacked-together DSL

YAML paints itself as a human-friendly serialization language, but my experience has been far from it. Compared to TOML (which is more suitable for configuration files) or JSON (for data consumed by systems), any reasonably-sized YAML file quickly becomes a mess of whitespace-sensitive mixed data types, without any rainbow brackets to help you find your way around it.

Even if it was a decent format that didn't confuse strings and other types so often, it definitely wasn't made with something like GitHub Actions workflows in mind. Pushing the format beyond its limits with conditionals, matrix variables, communication between jobs, not to mention an allow-by-default permission system, and several pitfalls that you'd only catch with a proper linter like [Zizmor](https://zizmor.sh/) &ndash; which, at the very least, has the good sense of being local-first.

Add to it that the de-facto ways of writing your own actions are with a bunch of blocks of shell code glued together in YAML, or via an imperative approach with Node.JS, and you end up with a complex system, made from opaque building blocks abstracting away what would've been two or three CLI commands.

I got frustrated enough times that I ended up thinking, "there has to be a better way". And I was already deep in the Nix rabbithole, so I thought to connect this problem and this tool into a solution.

## What happens now

I'd decided to initially tackle a few of these issues: the fact that workflows don't use an actual programming language, and that they couldn't be run locally. Add to that Nix's superpower of creating reproducible environments, while keeping GitHub Actions's three-layer structure, and [you get `now`](https://now.dev.br).

![now's logo, with a spiral-y arrow pointing inwards and the word "now" both printed on a worn sticker.](/images/posts/stop-writing-workflows-in-yaml/now.png)

While it was initially intended as an alternative CI runner &ndash; with features like remote runners by using Nix's own `builders` settings, different checkout strategies, and secret handling &ndash;, `now` is just as powerful as a local command runner. By parsing Nix inputs and leaving all the orchestration side to Rust (with a pinch of Zig for small, zero-deps scripts), it allows for local-first workflow definitions that can run anywhere you can install Nix on.

## A full example

Here's a taste of what a `now` workflow looks like:

```nix title="now.nix"
{ runner, ... }: {
  default = [ "push-docker" ];

  jobs = {
    build-docker =
      runner.matrix
        [
          {
            pkgs = import <nixpkgs> { system = "x86_64-linux"; };
            requiredSystemFeatures = [ "docker" ];
          }
          {
            pkgs = import <nixpkgs> { system = "aarch64-linux"; };
            requiredSystemFeatures = [ "docker" ];
          }
        ]
        (
          { pkgs, ... }: {
            name = "Build Docker (${pkgs.stdenv.hostPlatform.system})";
            steps = [
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
      needs = [ "build-docker" ];
      steps = [
        {
          name = "Login to DockerHub";
          env = {
            DOCKERHUB_PUSH_TOKEN = runner.secret "DOCKERHUB_PUSH_TOKEN";
            DOCKERHUB_USERNAME = runner.var "DOCKERHUB_USERNAME";
          };
          run = ''
            echo "$DOCKERHUB_PUSH_TOKEN" | docker login \
              --password-stdin --username $DOCKERHUB_USERNAME docker.io
          '';
          teardown = ''
            docker logout docker.io
          '';
          path = [ pkgs.docker ];
        }
        {
          name = "Login to GHCR";
          env = {
            GITHUB_TOKEN = runner.secret "GITHUB_TOKEN";
            GITHUB_USERNAME = runner.var "GITHUB_USERNAME";
          };
          run = ''
            echo "$GITHUB_TOKEN" | docker login \
              --password-stdin --username $GITHUB_USERNAME ghcr.io
          '';
          teardown = ''
            docker logout ghcr.io
          '';
          path = [ pkgs.docker ];
        }
        {
          name = "Push images";
          env = {
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
          run = ''
            for TAG in $TAGS; do
              skopeo copy docker-archive:$AMD_IMAGE "docker://$TAG-amd64"
              skopeo copy docker-archive:$ARM_IMAGE "docker://$TAG-arm64"
              docker buildx imagetools create \
                --tag "$TAG" "$TAG-amd64" "$TAG-arm64"
            done
          '';
          path = [
            pkgs.docker
            pkgs.docker-buildx
            pkgs.skopeo
          ];
        }
      ];
    };
  };
}
```

If you're familiar with [the Nix language](https://nixos.org/), the code above should read intuitively, even if it is somewhat convoluted. We declare two jobs, `build-docker` and `push-docker`, with an explicit dependency between them via `needs = [ "build-docker" ]`. The first one builds a Docker image (as a Nix derivation, of course) on both x86_64 and aarch64, while the second logs into the Docker registries and pushes our images.

Some differences from GitHub Actions that stand out:

- Specifying workers with different architectures is as easy as instantiating `nixpkgs` for each one. Plus, we set `requiredSystemFeatures` to only reach hosts that advertise a running Docker daemon.
- `runner.steps.upload` builds and shares our Docker images, which we can later on fetch with `runner.download`.
- We declare our environment variables and packages for each step. One step might take in `pkgs.docker` and a certain secret envvar, while the next may only need `pkgs.skopeo`. This is very similar to having per-step development shells.
- We can use actual functional programming! This lets us perform all sorts of operations ourselves rather than relying on external actions.
- Cleanup is a first-class feature via `teardown` scripts.

The Nix world model fits the declarative CI use-case like a glove. All communication happens via the orchestration layer or via the Nix store, through derivations. And all that you need in order to use remote runners is an SSH connection to a machine running Nix.

## Now and forever

This is just scratching the surface; `now` is packed with useful features. To name a few:

- Instead of relying solely on bash, you can specify scripts in [whatever shell you'd like](https://now.dev.br/options/#stepshell), be it `nushell` or `python3`, or even `rust-script`.
- [Sandboxing](https://now.dev.br/configuration/#sandboxing) lets you run steps with restricted and granular permissions.
- You can use [different checkout strategies](https://now.dev.br/configuration/#checkout) depending on whether the current directory should be copied over to remote runners or not.
- Being local-first, `now` has [multiple ways of verifying your workflow](https://now.dev.br/writing-your-own-jobs/#checking-your-workflow) before you actually run anything.
- [Shebang support](https://now.dev.br/configuration/#shebang-support) means you can distribute `now` workflows as a single file.
- As a powerful and extensible command runner, it even supports running development dependencies like PostgreSQL [with its services add-on](https://now.dev.br/services/).
- You can easily invoke `now` [in your own GitHub Actions](https://now.dev.br/cookbook/#using-in-github-actions), making it trivial to hook it up to your existing CI.

One caveat is that `now` relies on a "bring your own runners" approach, requiring an SSH connection to them &ndash; which isn't really compatible with the GitHub Actions runners model. Which means that it's not a one-to-one replacement (unless you figure something out with [upterm](https://github.com/owenthereal/action-upterm/), in which case, let me know!) &ndash; but for my use-cases, it's definitely enough to fill the gaps that GHA creates.

Despite the slow startup times due to Nix evaluation and derivation building, it's still quite a good replacement for tools like [`just`](https://github.com/casey/just) as well, especially if you need a bunch of tools pinned down to reproducible versions. Here are some things I already use `now` for every now and then:

- Setting up repositories.
- Deploying Nix-built websites to servers.
- Running `now`'s own test suite.
- Automating formatting, linting, and testing chores in [Sandhole](https://codeberg.org/sandhole/sandhole/src/branch/main/now.nix).
- Pushing cross-compiled Docker images to a Raspberry Pi.
- Building AppImages in [an FHS-compatible environment](https://now.dev.br/cookbook/#running-steps-in-an-fhs-compatible-environment).

`now` is released under AGPL-3.0. If it sounds like it could solve an issue you have with GitHub Actions or other command runners, [check out its documentation](https://now.dev.br/) and give it a try!<span class="cursor">█</span>

---

_Need any help? [Drop a ping on Mastodon](https://mastodon.xyz/@epiceric) or [e-mail me](mailto:now@eric.dev.br)._
