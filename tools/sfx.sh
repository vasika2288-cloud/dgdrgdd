#!/usr/bin/env bash
# Mixes the voiceover with synthesized sound effects into out/mix.wav (51.5 s).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
D=51.5

# tone <freq> <dur> <vol> <delay_ms>
tone() { echo "sine=f=$1:d=$2,afade=t=out:st=0:d=$2:curve=exp,volume=$3,adelay=$4:all=1"; }
# noise <dur> <highpass_hz> <vol> <delay_ms>
noise() { echo "anoisesrc=c=white:d=$1,highpass=f=$2,afade=t=out:st=0:d=$1,volume=$3,adelay=$4:all=1"; }

SRC=(
  "sine=f=55:d=$D,volume=0.07"
  "anoisesrc=c=brown:d=$D,lowpass=f=260,volume=0.10"
  "$(tone 988 1.0 0.30 4040)" "$(tone 784 1.3 0.30 4480)"         # doorbell
  "$(noise 0.06 1500 0.9 24560)" "$(tone 110 0.12 0.8 24560)"      # handle snaps back
  "$(noise 0.04 2500 0.6 25780)"                                    # lock
  "$(tone 425 0.5 0.10 27300)"                                      # dial tone
  "$(noise 0.03 3000 0.35 30640)" "$(noise 0.03 3000 0.35 31300)" "$(noise 0.03 3000 0.35 31780)" "$(noise 0.03 3000 0.35 32680)"
  "$(noise 0.03 3000 0.35 41100)" "$(noise 0.03 3000 0.35 41980)" "$(noise 0.03 3000 0.35 42800)" "$(noise 0.03 3000 0.35 43780)"
  "$(tone 70 0.3 0.9 44330)" "$(noise 0.06 800 0.5 44330)"         # stamp
  "$(tone 1318 0.4 0.22 47200)" "$(tone 1760 0.5 0.18 47300)"      # message
  "$(tone 1318 0.4 0.22 49580)"
  "$(tone 45 1.4 1.0 50000)" "$(tone 90 0.9 0.5 50000)"            # final hit
)

args=(-i assets/audio/voice.mp3)
labels="[0:a]"
i=1
for s in "${SRC[@]}"; do
  args+=(-f lavfi -i "$s")
  labels+="[$i:a]"
  i=$((i + 1))
done
ffmpeg -v error -y "${args[@]}" -filter_complex "${labels}amix=inputs=$i:normalize=0:duration=longest,alimiter=limit=0.95,apad=whole_dur=$D,atrim=0:$D" -ar 48000 -ac 2 out/mix.wav
echo "out/mix.wav"
