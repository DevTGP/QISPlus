# QISPlus

Eine Chrome-Erweiterung für das **QIS-Portal der Hochschule Trier**, die den Notenspiegel um eine kompakte Übersicht ergänzt — direkt auf der Seite, ohne Drittanbieter, ohne Login bei externen Diensten.

---

## Was QISPlus dir zeigt

Sobald du im QIS deinen Notenspiegel öffnest, erscheint oberhalb der Tabelle ein zusätzliches Widget mit:

- **Notendurchschnitt, ECTS-Fortschritt und bestmöglicher Schnitt** auf einen Blick (Gesamt-ECTS frei konfigurierbar im Popup)
- **Ziel-Schnitt-Rechner** 🎯 — berechnet den nötigen Durchschnitt für die verbleibenden ECTS
- **Verbesserungs- und „Was-wäre-wenn"-Simulation** — global per Knopfdruck oder pro Modul mit hypothetischer Note, alles live
- **Sortier- und gruppierbare Modultabelle** mit Semester-Schnitt-Pille; aktive Verbesserungen und laufende Module gekennzeichnet
- **Frühere Versuche** (Rücktritt, nicht bestanden, Freiversuch, Atteste, …) optional einblendbar

Über das Symbol in der Browser-Leiste lässt sich das Widget jederzeit komplett ein- oder ausblenden, dort wird auch die Gesamt-ECTS-Zielsumme eingestellt.

---

## Installation

QISPlus ist nicht im Chrome Web Store verfügbar und wird manuell installiert.

1. Auf der [Tags-Seite](https://github.com/DevTGP/QISPlus/tags) den aktuellen Tag als `.zip` herunterladen und entpacken.
2. In Chrome (oder Edge / Brave) `chrome://extensions` öffnen.
3. Oben rechts den **Entwicklermodus** aktivieren.
4. Auf **„Entpackte Erweiterung laden"** klicken und den entpackten Ordner auswählen.
5. Fertig — das QISPlus-Symbol erscheint in der Browser-Leiste.

Sobald du im QIS auf eine Notenspiegel-Seite navigierst, baut sich das Widget automatisch auf.

---

## Updates

QISPlus prüft im Hintergrund auf neue Versionen auf GitHub und zeigt bei Bedarf einen Hinweis mit Download-Link im Popup.

---

## Datenschutz

Alle Berechnungen laufen **lokal**. Es werden keine Noten oder persönlichen Daten an Server gesendet — die einzige externe Verbindung ist die anonyme Versions-Abfrage an die GitHub-API. Lokal gespeichert werden lediglich deine Einstellungen (Schalterzustände, Gesamt-ECTS, Versions-Cache).

---

## Hinweise

- Funktioniert ausschließlich auf `qis.hochschule-trier.de`.
- Die ECTS-Zielsumme ist auf **180** voreingestellt (Standard-Bachelor) und lässt sich direkt im Popup auf einen abweichenden Studiengang anpassen.
