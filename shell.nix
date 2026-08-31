{
  inputs ? import ./.tack,
  system ? builtins.currentSystem,
  pkgs ? import inputs.nixpkgs { inherit system; },
}:
pkgs.mkShell {
  packages = [
    (import inputs.now { })
    pkgs.rsync
    pkgs.zola
  ];
}
