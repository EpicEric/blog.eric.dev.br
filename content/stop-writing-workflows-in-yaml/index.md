+++
title = "Stop writing workflows in YAML"
authors = ["Eric Rodrigues Pires"]
description = "How I got too frustrated with GitHub Actions and ended up making my own thing."
date = 2026-10-18
taxonomies.tags = ["Nix", "Rust", "now"]
+++

{% crt() %}

```
 .------------------.
|    ___________     |
|   / _________ \    |
|  / /   _____ \ \   |
| | |   |_    | | |  |
|  \ \___/ /|_| | |  |
|   \_____/    /_/   |
 \__________________/
```

{% end %}

If you've had to mess with GitHub Actions, you've probably been there, too. You write (or more likely, you copy-paste and adjust) a workflow, you push it to a branch, and you hope that it runs like you would expect. If you're lucky, you'll get a mistake that's easy to fix, like a missing variable in your environment. If not, well... there goes the rest of your workday.

The fact that we have free CI runners at the disposal of open-source software has been a great boom for many projects, but there's nothing quite as painful as the slow iteration cycle of getting things to work just right. Among the many usual complaints, the lack of tooling to validate workflows locally or how you're [prone to supply chain attacks from malicious actions](https://cybersecuritynews.com/ghostaction-supply-chain-campaign/) are some of the few levied against it.

But my main gripe with GitHub Actions would be the fact that you declare them in pure YAML.

## A hacked-together DSL

YAML paints itself as a human-friendly serialization language, but my experience has been far from it. Compared to TOML (which is more suitable for configuration files) or JSON (for data consumed by systems), any reasonably-sized YAML file quickly becomes a mess of whitespace-sensitive mixed data types, without any rainbow brackets to help you find your way around it.

Even if it was a decent format that didn't confuse strings and other types so often, it definitely wasn't made with something like GitHub Actions workflows in mind. Pushing the format beyond its limits with conditionals, matrix variables, communication between jobs, not to mention an allow-by-default permission system, and several pitfalls that you'd only catch with a proper linter like [Zizmor](https://zizmor.sh/) &ndash; which, at the very least, has the sense to be local-first.

Add to it that the de-facto ways of writing your own actions are with a bunch of blocks of shell code glued together in YAML, or via an imperative approach with Node.JS, and you end up with a complex system, made from opaque building blocks abstracting away what would've been two or three CLI commands.

I got frustrated enough times that I ended up thinking, "there has to be a better way". And I was already deep in the Nix rabbithole, so I thought to connect this problem and this tool into a solution.

## What happens now



---

_Need any help? [Drop a ping on Mastodon](https://mastodon.xyz/@epiceric) or [e-mail me](mailto:now@eric.dev.br)._
