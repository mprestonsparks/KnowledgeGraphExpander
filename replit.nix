{pkgs}: {
  deps = [
    pkgs.openssh
    pkgs.cacert
    pkgs.jq
    pkgs.glibcLocales
    pkgs.xsimd
    pkgs.pkg-config
    pkgs.libxcrypt
    pkgs.postgresql
  ];
}
