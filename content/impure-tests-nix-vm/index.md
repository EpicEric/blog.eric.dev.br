+++
title = "Impure Rust tests in Nix with virtual machines"
authors = ["Eric Rodrigues Pires"]
description = "The pitfalls of running impure tests in Nix, and a proposed way to run them reproducibly."
date = 2026-02-14
taxonomies.tags = ["Nix", "Rust", "testing"]
+++

{% crt() %}

```
         .-----------.
        (    OK! =D   )
         `-----. ,---´
               |/
               '
    .----------------------.
    |      __   __  __     |
    |     _\ \__\ \/ /     |
    |    /_______\  / /\   |
    |      / /    \ \/ /_  |
    |   __/ /      \/ __/  |
    |  /_  /\      / /     |
    |   / /\ \____/_/__    |
    |   \/ /  \___  __/    |
    |     /_/\_\  \_\      |
    |                      |
    +----------------------+
   /// __________________ \\\
  /// ____________________ \\\
 /// ______________________ \\\
'------------------------------'
```

{% end %}

Nix is a great system not only to distribute packages, but to create reproducible development environments and even an entire operating system. Being based on memory discipline and functional programming principles, it comes with a lot of guarantees as well as limitations.

One of those limitations is running tests, which are normally declared as derivations (the building blocks of Nix). While convenient, the default sandbox can prove to be quite challenging to work with, with restrictions in unexpected ways. This post proposes a different way of running tests that require a full-fledged user environment, without missing out on Nix's features.

tl;dr: [skip to the solution](#the-solution).

## Our example program

To illustrate, let's make a simple command line hostname resolver in Rust, named `mydns`. We'll break it into two parts: one that serves as the CLI entrypoint, and another with the main logic of our application.

```rust,name=main.rs
use std::{
    io::{self},
    net::{IpAddr, ToSocketAddrs},
};

/// Command-line interface of mydns.
fn main() {
    let mut args = std::env::args();
    args.next(); // Skip program name argument
    let host = args.next().expect("argument must be provided");
    if args.next().is_some() {
        panic!("Too many arguments!");
    }
    let ip_list = get_ip_list_for_host(&host).expect("should get IP list for host");
    if ip_list.is_empty() {
        eprintln!("No IPs found!");
    } else {
        for ip in ip_list {
            println!("{ip}");
        }
    }
}

/// Given a host, return the list of IP address that it resolves to.
fn get_ip_list_for_host(host: &str) -> io::Result<Vec<IpAddr>> {
    let socket_addrs = (host, 443).to_socket_addrs()?;
    Ok(socket_addrs.map(|addr| addr.ip()).collect())
}
```

And we'll also write some tests to ensure basic functionality of `get_ip_list_for_host`:

```rust,name=main.rs
// ...

#[cfg(test)]
mod mydns_tests {
    use std::net::{IpAddr, Ipv4Addr};

    use crate::get_ip_list_for_host;

    #[test]
    /// Test that an IP address returns itself.
    fn local_ip() {
        assert_eq!(
            get_ip_list_for_host("127.0.0.1").unwrap(),
            vec![IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1))],
        );
    }

    #[test]
    /// Test that a nip.io subdomain (which resolves to itself)
    /// returns the expected address.
    fn ip_for_nip_io() {
        assert_eq!(
            get_ip_list_for_host("52-0-56-137.nip.io").unwrap(),
            vec![IpAddr::V4(Ipv4Addr::new(52, 0, 56, 137))],
        );
    }
}
```

If we run `cargo test`, the tests should just pass. Great!

## Distributing with Nix

With our simple program ready to go, let's use Nix to distribute it around. I'm using [crane](https://crane.dev) and a [flake](https://nix.dev/concepts/flakes) in this example, but this should be transferrable to any other setup.

```nix,name=flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    crane.url = "github:ipetkov/crane";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      crane,
      rust-overlay,
      ...
    }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      eachSystem =
        f:
        (builtins.foldl' (
          acc: system:
          let
            fSystem = f system;
          in
          builtins.foldl' (
            acc': attr:
            acc'
            // {
              ${attr} = (acc'.${attr} or { }) // fSystem.${attr};
            }
          ) acc (builtins.attrNames fSystem)
        ) { } systems);
    in
    eachSystem (
      system:
      let
        rustChannel = "stable";
        rustVersion = "latest";

        pkgs = import nixpkgs {
          inherit system;
          overlays = [ (import rust-overlay) ];
        };

        inherit (pkgs) lib;

        craneLib = (crane.mkLib pkgs).overrideToolchain (
          p: p.rust-bin.${rustChannel}.${rustVersion}.default
        );

        src = craneLib.cleanCargoSource ./.;

        commonArgs = {
          inherit src;
          strictDeps = true;
        };

        cargoArtifacts = craneLib.buildDepsOnly commonArgs;

        mydns = craneLib.buildPackage (
          commonArgs
          // {
            inherit cargoArtifacts;
            doCheck = false;
            meta.mainProgram = "mydns";
          }
        );
      in
      {
        packages.${system} = {
          inherit mydns;
          default = mydns;
        };

        apps.${system}.default = {
          type = "app";
          program = lib.getExe mydns;
        };

        devShells.${system}.default = craneLib.devShell {
          checks = self.checks.${system};
          packages = [ pkgs.cargo-nextest ];
        };

        checks.${system} = { };
      }
    );
}
```

That's all well and good... but what do we put in `checks`? Well, we went through all that effort of writing our testsuite, so let's get a derivation with `cargo nextest` in there:

```nix,name=flake.nix,hide_lines=1 9
{
checks.${system} = {
  mydns-tests = craneLib.cargoNextest (
    commonArgs
    // {
      inherit cargoArtifacts;
    }
  );
}
```

Now, let's try to run our tests.

```hl_lines=21-23
$ nix flake check
error: Cannot build '/nix/store/5w1hiyys609bqvmsl4zcqf4w5qpagl6i-mydns-nextest-0.1.0.drv'.
       Reason: builder failed with exit code 100.
       Output paths:
         /nix/store/m6g8yd7wyv8kqgmr29h6chwnvn4b6m10-mydns-nextest-0.1.0
       Last 25 log lines:
       >   stdout ---
       >
       >     running 1 test
       >     test mydns_tests::ip_for_nip_io ... FAILED
       >
       >     failures:
       >
       >     failures:
       >         mydns_tests::ip_for_nip_io
       >
       >     test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 1 filtered out; finished in 0.00s
       >
       >   stderr ---
       >
       >     thread 'mydns_tests::ip_for_nip_io' (152) panicked at src/main.rs:47:56:
       >     called `Result::unwrap()` on an `Err` value: Custom { kind: Uncategorized, error: "failed to lookup address information: Temporary failure in name resolution" }
       >     note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
       >
       >   Cancelling due to test failure:
       > ------------
       >      Summary [   0.004s] 2 tests run: 1 passed, 1 failed, 0 skipped
       >         FAIL [   0.003s] mydns::bin/mydns mydns_tests::ip_for_nip_io
       >   Cancelling [ 00:00:00] ============== 2/2: 2 running, 0 passed, 0 skipped
       >              [ 00:00:00] mydns::bin/mydns mydns_tests::local_ip
       > error: test run failedn/mydns mydns_tests::ip_for_nip_io
```

Oops! That shouldn't have happened...

Let's take a closer look at the logs of the failed test, highlighted above. The key part is _"failed to lookup address information: Temporary failure in name resolution"_.

Nix derivations are, by default, built in a sandboxed environment. This limits access to the host filesystem which might cause impureness, and restricts any access to the external network to inputs that can be cryptographically verified with a hash.

This ends up being a problem for us! Under the hood, our address lookup makes use of `/etc/hosts` for [static name resolution](https://man.archlinux.org/man/hosts.5) and, failing that, it uses a [DNS resolver](https://man.archlinux.org/man/resolv.conf.5) that will potentially query an external nameserver. Both of which are not allowed in derivations!

Typically in, say, nixpkgs, we'd just skip the impure tests and manually ensure that our binary runs. But this means that our application is basically untested, and we miss out on other niceties like [Garnix CI](https://garnix.io/). This might be fine for your use-case, but can we do better?

## The solution

Luckily, we can use NixOS virtual machines in QEMU to run our tests in a controlled environment! Here's one way to go about it:

```nix,name=flake.nix,hide_lines=1 64
{
checks.${system} = {
  mydns-tests =
    let
      nextest-archive = craneLib.mkCargoDerivation (
        commonArgs
        // {
          inherit cargoArtifacts;
          doCheck = false;
          pname = "mydns-nextest-archive";
          nativeBuildInputs = (commonArgs.nativeBuildInputs or [ ]) ++ [ pkgs.cargo-nextest ];
          buildPhaseCargoCommand = ''
            cargo nextest archive --archive-format tar-zst --archive-file archive.tar.zst
          '';
          installPhaseCommand = ''
            mkdir -p $out
            cp archive.tar.zst $out
          '';
        }
      );
    in
    pkgs.testers.runNixOSTest {
      name = "mydns-nextest";
      nodes = {
        machine =
          { ... }:
          {
            virtualisation.diskSize = 4096;
            networking.hosts = {
              "52.0.56.137" = [ "52-0-56-137.nip.io" ];
            };
            systemd.services.cargo-nextest = {
              description = "Integration Tests for mydns";
              wantedBy = [ "multi-user.target" ];
              after = [ "network-online.target" ];
              wants = [ "network-online.target" ];
              path = [
                pkgs.cargo
                pkgs.cargo-nextest
              ];
              script = ''
                cp -r ${src}/* .
                cargo nextest run \
                  --archive-file ${nextest-archive}/archive.tar.zst \
                  --workspace-remap .
              '';
              serviceConfig = {
                StateDirectory = "cargo-nextest";
                StateDirectoryMode = "0750";
                WorkingDirectory = "/var/lib/cargo-nextest";
                Type = "oneshot";
                RemainAfterExit = "yes";
                Restart = "no";
              };
            };
          };
      };
      testScript = ''
        machine.start()
        machine.wait_for_unit("cargo-nextest.service")
      '';
    };
};
}
```

That's a lot to take in at once, so let's go over it step by step.

The core idea is to build our tests in a derivation in one step, then run them as a systemd service inside of a NixOS virtual machine in the next step, where every dependency and pre-requisite are set up appropriately. Finally, we ensure that the systemd service ran to a successful completion.

1. For the first step, we could use `cargo test --no-run`, which will build a test binary for us. However, we'd need a way to find its exact name from the derivation. Instead, we'll use [cargo-nextest's archiving feature](https://nexte.st/docs/ci-features/archiving/), which has a much simpler setup, and save the archive to the output of the derivation.

```nix,hide_lines=20
let
  nextest-archive = craneLib.mkCargoDerivation (
    commonArgs
    // {
      inherit cargoArtifacts;
      doCheck = false;
      pname = "mydns-nextest-archive";
      nativeBuildInputs = (commonArgs.nativeBuildInputs or [ ]) ++ [ pkgs.cargo-nextest ];
      buildPhaseCargoCommand = ''
        cargo nextest archive --archive-format tar-zst --archive-file archive.tar.zst
      '';
      installPhaseCommand = ''
        mkdir -p $out
        cp archive.tar.zst $out
      '';
    }
  );
in
# ...
{}
```

2. Next, we create a `oneshot` systemd service which will unpack the Rust sources (required for nextest's archiving to work) and run the tests. We'll need to copy the source files rather than link directly, since `cargo nextest` requires write permissions to the `target/` directory in the Cargo workspace (and `/nix/store` is read-only). But other than that, it's a relatively straightforward systemd service. I added comments to the crucial parts below.

```nix,hide_lines=1 28
{
systemd.services.cargo-nextest = {
  description = "Integration Tests for mydns";
  wantedBy = [ "multi-user.target" ]; # Make this service part of the normal system boot process
  after = [ "network-online.target" ]; # Wait until we're connected to the network
  wants = [ "network-online.target" ]; # Same as above
  path = [
    pkgs.cargo
    pkgs.cargo-nextest
    # Add any other runtime dependencies to the PATH
  ];
  # Unpack source files and run cargo nextest
  script = ''
    cp -r ${src}/* .
    cargo nextest run \
      --archive-file ${nextest-archive}/archive.tar.zst \
      --workspace-remap .
  '';
  serviceConfig = {
    StateDirectory = "cargo-nextest"; # Create the /var/lib/cargo-nextest directory
    StateDirectoryMode = "0750";
    WorkingDirectory = "/var/lib/cargo-nextest"; # Run our script in the state directory
    Type = "oneshot";
    RemainAfterExit = "yes";
    Restart = "no";
  };
};
}
```

3. With our archive being built in a separate derivation, and the tests being run inside the systemd service, all we have to do is start a virtual machine that executes and waits for the service. Here, we can also set any configs we normally would with a NixOS machine, and perhaps even declare other machines to connect to during tests, such as a database. In our `testScript`, it's crucial that we wait for the `cargo-nextest.service` to complete and signal that the test was successful.

```nix,hide_lines=1 25
{
pkgs.testers.runNixOSTest {
  name = "mydns-nextest";
  nodes = {
    machine =
      { ... }:
      {
        # Increase or decrease the disk size as appropriate
        virtualisation.diskSize = 4096;
        # Add extra settings, eg. hosts to resolve at runtime
        networking.hosts = {
          "52.0.56.137" = [ "52-0-56-137.nip.io" ];
        };
        systemd.services.cargo-nextest = {
          # -snip-
        };
      };
  };
  # Our NixOS test consists of waiting for our service to complete successfully
  testScript = ''
    machine.start()
    machine.wait_for_unit("cargo-nextest.service")
  '';
};
}
```

Now run `nix flake check` again, and it all magically comes together! Whew.

You can find the [complete demo on GitHub](https://github.com/EpicEric/nix-impure-tests-demo).

## Bonus: Interacting with the VM

A lot of the ideas behind this were borrowed from [this post by Blake Smith](https://blakesmith.me/2024/03/02/running-nixos-tests-with-flakes.html). One neat thing that he mentions in his article is how we can access our VM interactively:

```
$ nix run .#checks.x86_64-linux.mydns-tests.driverInteractive

In[1]: machine.start()
```

A window should pop up with a shell into your NixOS virtual machine, where you can poke around and inspect the results of your tests:

![Logging into the QEMU virtual machine as root and running systemctl status cargo-nextest.service to see that our tests were successful.](./qemu.png)

---

_Need any help? [Drop a ping on Mastodon](https://mastodon.xyz/@epiceric) or [e-mail me](mailto:nix@eric.dev.br)._
