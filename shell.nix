{
  inputs ? import ./.tack,
  system ? builtins.currentSystem,
  pkgs ? import inputs.nixpkgs { inherit system; },
}:
pkgs.mkShell {
  packages = [
    pkgs.rsync
    pkgs.zola
  ];
}
