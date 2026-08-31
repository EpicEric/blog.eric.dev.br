{ runner, ... }:
{
  jobs = {
    build = {
      steps = [
        (runner.steps.upload "blog" (import ./. { }))
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
            path = [
              pkgs.rsync
            ];
          }
        ];
      };
  };
}
