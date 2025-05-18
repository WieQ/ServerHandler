#!/bin/bash

echo "Start.sh: gotowy na komendy. Wpisz 'help' po instrukcje."

while true; do
  read -r input
  case "$input" in
    help)
      echo "Dostępne komendy: help, echo <tekst>, time, exit"
      ;;
    echo\ *)
      echo "${input#echo }"
      ;;
    time)
      date +"%Y-%m-%d %H:%M:%S"
      ;;
    exit)
      echo "Zamykam..."
      exit 0
      ;;
    *)
      echo "Nieznana komenda: $input"
      ;;
  esac
done
