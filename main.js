let ects = 0;
let points = 0;
let grade = 0;

const table = document.getElementsByTagName('table')[1].children[0];
console.log(table)

function isNonHeaderRow(row) {
    return row.children[0].classList.contains('ns_tabelle1_alignleft');

}
function isModuleHeader(row) {
    return row.children[0].classList.contains('qis_konto');
}


function deletable(row) {
    if (isNonHeaderRow(row)) {
        return row.children[3].innerHTML.toString().trim() == '';
    }
    if (isModuleHeader(row)) {
        return row.children[2].innerHTML.toString().trim() == '';
}
    }

for (let i = 0; i < 3; i++) {
    for (let row of table.children) {
        if (deletable(row)) {
            row.remove();
        }
    }
}
for (let row of table.children) {
    if (isNonHeaderRow(row)) {
        let a = Number(row.children[3].innerHTML.toString().replace(',', '.'));
        let b = Number(row.children[5].innerHTML);
        console.log(a,b )
        console.log(grade, points, ects )
        points += a*b;
        ects += b;
    }
}

grade = Math.round(points/ects * 100) / 100
console.log(grade, points, ects )
document.getElementsByClassName('qis_kontoOnTop')[2].innerHTML = grade;
document.getElementsByClassName('qis_kontoOnTop')[4].innerHTML = ects;
