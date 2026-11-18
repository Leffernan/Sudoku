# Dagens Sudoku

Bygdebladet sitt daglege Sudoku med tre vanskegrader. Datoen følgjer `Europe/Oslo`. Alle får det same brettet for same dato og nivå. Nye brett er tilgjengelege ved midnatt utan planlagde jobbar.

## Innbygging i nettavisa

Lim inn heile blokka i HTML-feltet i artikkelen.

```html
<div data-bb-sudoku>
  <iframe
    src="https://leffernan.github.io/Sudoku/"
    title="Dagens Sudoku frå Bygdebladet"
    height="1080"
    style="display:block;width:100%;border:0;background:#F7F3E9"
  ></iframe>
</div>
<script src="https://leffernan.github.io/Sudoku/embed-host.js" defer></script>
```

Skriptet tilpassar høgda etter breidda på artikkelen og lèt stadfestingsvindauget opne over artikkelen.

## Gjennomgang av den gamle koden

| Funn | Endring |
| --- | --- |
| Koden fjerna tal utan å sjekke om brettet hadde éi løysing. Sjekken kunne dermed merke ei gyldig alternativ løysing som feil. | Generatoren tel løysingar, forkastar alle brett med fleire løysingar og kontrollerer fasiten. |
| Vanskegraden følgde berre talet på tomme felt. | Nivåa blir skilde etter kva løysingsteknikkar som trengst, i tillegg til talet på gitte felt. |
| Datoen var knytt til ISO-veka og tidssona til lesaren. | Dagleg brett knytt til norsk tid. Ei open økt får beskjed når neste sett er klart. |
| Nivåknappane bad om å nullstille brettet. Lagringa la også inn fasit og brett på nytt for kvar endring. | Nivåbytet hentar framdrifta som høyrer til datoen og nivået. Nettlesaren lagrar speltilstanden og kontrollerer han mot dagsbrettet. |
| Spelbrettet blei bygd opp på nytt ved fokus og etter kvart trekk. Det kunne flytte fokus og gjorde tastaturnavigering vanskeleg. | Feltelementa blir gjenbrukte. Piltastane flyttar markøren, tala fyller inn feltet og Delete slettar. |
| Hjelpehandlingar kunne vise fasiten straks eller leggje fleire feilrettingar i separate angresteg. | Fasiten krev stadfesting. Tømming av feil er eitt angresteg. Små notat kan leggjast inn utan å fylle feltet. |

## Brett og kontroll

Katalogen inneheld 48 brett per nivå. Lett kan løysast ved at eit felt berre har eitt mogleg tal. Middels krev òg å finne tal som berre passar éin stad i ei rad, kolonne eller rute. Vanskeleg krev meir enn desse to teknikkane. Dato og nivå styrer valet av grunnbrett og ei gyldig omplassering av radgrupper, kolonnegrupper og tal.

`node scripts/build-puzzles.mjs --check` kontrollerer at kvart grunnbrett har éi løysing, korrekt fasit og ønskt vanskegrad.
