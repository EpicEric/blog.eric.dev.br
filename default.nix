{
  sources ? import ./npins,
  system ? builtins.currentSystem,
  pkgs ? import sources.nixpkgs { inherit system; },
}:
let
  inherit (pkgs) stdenv lib;
in
stdenv.mkDerivation {
  name = "blog-eric-dev-br";

  src = lib.fileset.toSource {
    root = ./.;
    fileset = lib.fileset.unions [
      ./config.toml
      ./content
      ./grammars
      ./sass
      ./static
      ./themes
    ];
  };

  dontConfigure = true;

  nativeBuildInputs = [
    pkgs.zola
  ];

  buildPhase = ''
    runHook preBuild

    zola build

    runHook postBuild
  '';

  installPhase = ''
    mv public $out
  '';
}
