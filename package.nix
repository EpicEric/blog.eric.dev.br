{
  buildNpmPackage,
  importNpmLock,
  lib,
}:
buildNpmPackage {
  name = "blog-eric-dev-br";

  src = lib.fileset.toSource {
    root = ./.;
    fileset = lib.fileset.unions [
      ./astro.config.mjs
      ./package.json
      ./package-lock.json
      ./tsconfig.json
      ./public
      ./src
    ];
  };

  npmDeps = importNpmLock { npmRoot = ./.; };

  inherit (importNpmLock) npmConfigHook;

  makeCacheWritable = true;

  env.ASTRO_TELEMETRY_DISABLED = "1";

  installPhase = ''
    cp -r dist/ $out
  '';
}
