#! /usr/bin/env nix
#! nix shell git+https://codeberg.org/now-runner/now --command now
{ runner, ... }:
{
  inherit (import ./.tack) nixpkgs;

  jobs = {
    build = {
      steps = [
        (runner.steps.upload {
          name = "blog";
          deriv = import ./. { };
        })
      ];
    };

    publish =
      { pkgs, ... }:
      {
        needs = [ "build" ];
        steps = [
          {
            env = {
              BLOG = runner.download "blog";
              SSH_HOST = runner.secret "SSH_HOST";
            };
            run = ''
              rsync --delete-after -acP $BLOG/ $SSH_HOST:www
            '';
            path = [ pkgs.rsync ];
          }
        ];
      };
  };
}
