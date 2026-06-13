{
  inputs ? import ./.tack,
  system ? builtins.currentSystem,
  pkgs ? import inputs.nixpkgs { inherit system; },
}:
let
  inherit (pkgs) stdenvNoCC lib;
in
stdenvNoCC.mkDerivation {
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
    cp -r public/ $out
  '';
}
