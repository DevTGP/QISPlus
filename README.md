# QISPlus

Eine Chrome-Erweiterung für das **QIS-Portal der Hochschule Trier**, die den Notenspiegel um eine kompakte Übersicht ergänzt — direkt auf der Seite, ohne Drittanbieter, ohne Login bei externen Diensten.

---

## Was QISPlus dir zeigt

Sobald du im QIS deinen Notenspiegel öffnest, erscheint oberhalb der Tabelle ein zusätzliches Widget mit:

- **Aktueller Notendurchschnitt** (gewichtet nach ECTS)
- **ECTS-Fortschritt** mit Balken — *X / 180 erreicht*
- **Bestmöglicher Notenschnitt** unter der Annahme, dass alle verbleibenden Module mit 1,0 abgeschlossen werden
- **Notenverbesserungs-Simulation** auf Knopfdruck: zeigt, wie sich dein Schnitt entwickelt, wenn aktiv angemeldete Verbesserungen sowie alle Module aus dem letzten abgeschlossenen Semester eine 1,0 ergäben
- **Sortier- und gruppierbare Modultabelle** (nach Modul, Note, ECTS oder Semester)
- **Semester-Schnitt** als Pille direkt am jeweiligen Semester-Header
- **Aktive Verbesserungen und laufende Module** klar gekennzeichnet
- **Frühere Versuche** (Rücktritt, nicht bestanden, Freiversuch, Atteste, …) optional einblendbar
- **Farbcodierte Noten** für schnellen Überblick (grün = sehr gut, rot = problematisch)

Über das Symbol in der Browser-Leiste lässt sich das Widget jederzeit komplett ein- oder ausblenden.

---

## Installation

QISPlus ist nicht im Chrome Web Store verfügbar und wird manuell installiert.

1. Auf der [Releases-Seite](https://github.com/DevTGP/QISPlus/releases) das aktuelle Release-Asset (`.zip`) herunterladen und entpacken.
2. In Chrome (oder Edge / Brave) `chrome://extensions` öffnen.
3. Oben rechts den **Entwicklermodus** aktivieren.
4. Auf **„Entpackte Erweiterung laden"** klicken und den entpackten Ordner auswählen.
5. Fertig — das QISPlus-Symbol erscheint in der Browser-Leiste.

Sobald du im QIS auf eine Notenspiegel-Seite navigierst, baut sich das Widget automatisch auf.

---

## Updates

QISPlus prüft alle paar Stunden im Hintergrund, ob auf GitHub eine neuere Version veröffentlicht wurde. Liegt ein Update vor, erscheint im Popup ein Hinweis mit Download-Link. Aktualisiert wird durch das gleiche Verfahren wie die Erstinstallation: neuen Ordner laden bzw. den bestehenden in `chrome://extensions` über den Refresh-Button ersetzen.

---

## Datenschutz

Sämtliche Berechnungen passieren ausschließlich **lokal in deinem Browser**. QISPlus liest die Notenspiegel-Seite, die du ohnehin gerade ansiehst — es werden keine Noten, ECTS oder sonstigen Daten an externe Server gesendet. Die einzige ausgehende Verbindung ist eine periodische, anonyme Anfrage an die GitHub-API zur Versionsprüfung.

Es werden keine persönlichen Daten gespeichert. Lokal in den Erweiterungseinstellungen liegen lediglich deine Schalterzustände (Widget aktiv ja/nein, Verbesserungs-Simulation, frühere Versuche eingeblendet) und der zwischengespeicherte Versions-Check.

---

## Hinweise

- Funktioniert ausschließlich auf `qis.hochschule-trier.de`.
- Die ECTS-Zielsumme ist auf **180** voreingestellt (Standard-Bachelor). Wer in einem abweichenden Studiengang ist, kann den Wert in der Datei `src/constants.js` anpassen.
- Das Layout des QIS-Portals wird gelegentlich verändert; sollte das Widget einmal nicht erscheinen oder fehlerhafte Werte anzeigen, bitte ein [Issue auf GitHub](https://github.com/DevTGP/QISPlus/issues) eröffnen.

---

## Mitwirken

Pull Requests, Bug-Reports und Verbesserungsvorschläge sind willkommen — siehe [GitHub-Repo](https://github.com/DevTGP/QISPlus).
