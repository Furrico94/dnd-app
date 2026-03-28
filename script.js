function nuovoPG() {
    // Existing code...
    const tiriSalvezzaTable = `\n        <table>\n            <tr>\n                <th>Tiro Salvezza</th>\n                <th>Base</th>\n                <th>Caratt.</th>\n                <th>Magia</th>\n                <th>Altro</th>\n            </tr>\n            <tr>\n                <td>Tempra (COS)</td>\n                <td><input type='number' class='ts-tempra-base' /></td>\n                <td><input type='number' class='ts-tempra-caratt' /></td>\n                <td><input type='number' class='ts-tempra-magia' /></td>\n                <td><input type='number' class='ts-tempra-altro' /></td>\n            </tr>\n            <tr>\n                <td>Riflessi (DES)</td>\n                <td><input type='number' class='ts-riflessi-base' /></td>\n                <td><input type='number' class='ts-riflessi-caratt' /></td>\n                <td><input type='number' class='ts-riflessi-magia' /></td>\n                <td><input type='number' class='ts-riflessi-altro' /></td>\n            </tr>\n            <tr>\n                <td>Volontà (SAG)</td>\n                <td><input type='number' class='ts-volonta-base' /></td>\n                <td><input type='number' class='ts-volonta-caratt' /></td>\n                <td><input type='number' class='ts-volonta-magia' /></td>\n                <td><input type='number' class='ts-volonta-altro' /></td>\n            </tr>\n        </table>\n    `;
    // Insert tiriSalvezzaTable after the Punti Ferita section
    // Existing code...
}

function salvaPG() {
    const tiriSalvezza = {
        tempra: {
            base: document.querySelector('.ts-tempra-base').value,
            caratt: document.querySelector('.ts-tempra-caratt').value,
            magia: document.querySelector('.ts-tempra-magia').value,
            altro: document.querySelector('.ts-tempra-altro').value,
        },
        riflessi: {
            base: document.querySelector('.ts-riflessi-base').value,
            caratt: document.querySelector('.ts-riflessi-caratt').value,
            magia: document.querySelector('.ts-riflessi-magia').value,
            altro: document.querySelector('.ts-riflessi-altro').value,
        },
        volonta: {
            base: document.querySelector('.ts-volonta-base').value,
            caratt: document.querySelector('.ts-volonta-caratt').value,
            magia: document.querySelector('.ts-volonta-magia').value,
            altro: document.querySelector('.ts-volonta-altro').value,
        },
    };
    // Code to handle tiriSalvezza object...
}