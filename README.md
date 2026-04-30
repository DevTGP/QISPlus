# QISPlus

Eine Chrome-Erweiterung für das **QIS-Portal der Hochschule Trier**, die den Notenspiegel um eine kompakte Übersicht ergänzt — direkt auf der Seite, ohne Drittanbieter, ohne Login bei externen Diensten.

---

## Was QISPlus dir zeigt

Sobald du im QIS deinen Notenspiegel öffnest, erscheint oberhalb der Tabelle ein zusätzliches Widget mit:

- **Aktueller Notendurchschnitt** (gewichtet nach ECTS)
- **ECTS-Fortschritt** mit Balken — *X / Gesamt-ECTS erreicht* (Gesamtwert frei konfigurierbar im Popup)
- **Bestmöglicher Notenschnitt** unter der Annahme, dass alle verbleibenden Module mit 1,0 abgeschlossen werden
- **Ziel-Schnitt-Rechner** 🎯 — gib deinen Wunsch-Schnitt ein und QISPlus berechnet, welcher Durchschnitt auf den verbleibenden ECTS dafür nötig ist
- **Notenverbesserungs-Simulation** auf Knopfdruck: zeigt, wie sich dein Schnitt entwickelt, wenn aktiv angemeldete Verbesserungen sowie alle Module aus dem letzten abgeschlossenen Semester eine 1,0 (oder eine selbst gewählte Note) ergäben
- **Pro-Modul „Was-wäre-wenn"**: Klick auf eine bereits erbrachte Note öffnet ein Eingabefeld, in dem sich eine hypothetische Note setzen lässt — Schnitt, Bestm. Ø und Ziel-Rechner aktualisieren sich live
- **Sortier- und gruppierbare Modultabelle** (nach Modul, Note, ECTS oder Semester)
- **Semester-Schnitt** als Pille direkt am jeweiligen Semester-Header
- **Aktive Verbesserungen und laufende Module** klar gekennzeichnet
- **Frühere Versuche** (Rücktritt, nicht bestanden, Freiversuch, Atteste, …) optional einblendbar
- **Farbcodierte Noten** für schnellen Überblick (grün = sehr gut, rot = problematisch)

Über das Symbol in der Browser-Leiste lässt sich das Widget jederzeit komplett ein- oder ausblenden, dort wird auch die Gesamt-ECTS-Zielsumme eingestellt.

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

QISPlus prüft regelmäßig im Hintergrund (über einen Service-Worker mit `chrome.alarms`), ob auf GitHub eine neuere Version veröffentlicht wurde. Liegt ein Update vor, erscheint im Popup ein Hinweis mit Download-Link. Aktualisiert wird durch das gleiche Verfahren wie die Erstinstallation: neuen Ordner laden bzw. den bestehenden in `chrome://extensions` über den Refresh-Button ersetzen.

---

## Datenschutz

Sämtliche Berechnungen passieren ausschließlich **lokal in deinem Browser**. QISPlus liest die Notenspiegel-Seite, die du ohnehin gerade ansiehst — es werden keine Noten, ECTS oder sonstigen Daten an externe Server gesendet. Die einzige ausgehende Verbindung ist eine periodische, anonyme Anfrage an die GitHub-API zur Versionsprüfung.

Es werden keine persönlichen Daten gespeichert. Lokal in den Erweiterungseinstellungen liegen lediglich deine Schalterzustände (Widget aktiv ja/nein, Verbesserungs-Simulation, frühere Versuche eingeblendet), die eingestellte Gesamt-ECTS-Zahl sowie der zwischengespeicherte Versions-Check.

---

## Hinweise

- Funktioniert ausschließlich auf `qis.hochschule-trier.de`.
- Die ECTS-Zielsumme ist auf **180** voreingestellt (Standard-Bachelor) und lässt sich direkt im Popup auf einen abweichenden Studiengang anpassen.
