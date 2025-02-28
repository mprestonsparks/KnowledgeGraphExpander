{pkgs}: {
  deps = [
    pkgs.jq
    pkgs.glibcLocales
    pkgs.xsimd
    pkgs.pkg-config
    pkgs.libxcrypt
    pkgs.postgresql
  ];
}
