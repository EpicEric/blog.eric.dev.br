{
  inputs ? import ./.tack,
  system ? builtins.currentSystem,
  pkgs ? import inputs.nixpkgs { inherit system; },
}:
pkgs.callPackage ./package.nix { }
