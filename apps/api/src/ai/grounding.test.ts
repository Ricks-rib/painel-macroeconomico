import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkGrounding, collectNumbers } from './grounding.js';

/**
 * A checagem de ancoragem e o unico componente entre o modelo e um numero
 * errado exibido como se fosse do Banco Central. Por isso e o unico que tem
 * teste: os quatro primeiros casos abaixo sao regressoes reais, encontradas
 * rodando o assistente contra os dados de verdade, e cada um deles reprovava
 * uma resposta CORRETA.
 *
 * Usa o runner nativo do Node -- `node --test` via tsx --, sem dependencia
 * nova, na mesma linha do logger deste projeto.
 */

const DADOS_DO_DOLAR = {
  indicador: 'Dolar comercial (compra)',
  valor: 5.1512,
  unidade: 'R$',
  data: '2026-08-24',
  variacaoDesdeLeituraAnterior: { variacao: -0.2189, unidadeDaVariacao: '%' },
};

describe('checkGrounding', () => {
  const permitidos = collectNumbers(DADOS_DO_DOLAR);

  it('aceita o valor exato devolvido pela ferramenta', () => {
    assert.equal(checkGrounding('O dolar esta em R$ 5,1512.', permitidos).ok, true);
  });

  it('aceita arredondamento para duas casas (como se escreve cambio)', () => {
    assert.equal(checkGrounding('O dolar esta em R$ 5,15.', permitidos).ok, true);
  });

  it('aceita a variacao em modulo, com o sentido na palavra', () => {
    // Em portugues "queda de 0,22%" e a forma correta de dizer -0,22%.
    assert.equal(checkGrounding('Houve queda de 0,22%.', permitidos).ok, true);
  });

  it('aceita o dia do mes escrito por extenso', () => {
    // A data ISO deixa "-24" no conjunto; o texto diz "24 de agosto".
    assert.equal(checkGrounding('Cotacao de 24 de agosto de 2026.', permitidos).ok, true);
  });

  it('reprova um valor proximo, porem diferente', () => {
    const check = checkGrounding('O dolar esta em R$ 5,45.', permitidos);
    assert.equal(check.ok, false);
    assert.deepEqual(check.unsupported, ['5,45']);
  });

  it('reprova um percentual que nao veio de ferramenta nenhuma', () => {
    assert.equal(checkGrounding('A inflacao acumulada e de 7,3%.', permitidos).ok, false);
  });

  it('trata separador de milhar brasileiro como um numero so', () => {
    // Sem isso, "1.167.869" viraria "1.167" e "869" -- dois numeros que nunca
    // existiram -- e reprovaria uma resposta correta sobre o PIB.
    const doPib = collectNumbers({ valor: 1167869, unidade: 'R$ milhoes' });
    assert.equal(checkGrounding('O PIB somou 1.167.869 milhoes.', doPib).ok, true);
    assert.equal(checkGrounding('O PIB somou 9.876.543 milhoes.', doPib).ok, false);
  });

  it('tolera inteiros pequenos usados como linguagem', () => {
    assert.equal(checkGrounding('Os 4 indicadores seguem estaveis.', permitidos).ok, true);
    assert.equal(checkGrounding('Nos ultimos 12 meses o quadro mudou.', permitidos).ok, true);
  });

  it('nao tolera inteiro pequeno quando ele vem com unidade', () => {
    // Caso real, visto ao gravar a demonstracao: o modelo afirmou que a meta
    // do Banco Central "e de 3% a 5% ao ano". A meta e 3,00% com tolerancia
    // de 1,5 p.p. As duas pontas passavam so por serem menores que 12.
    //
    // Conjunto proprio, e nao o do dolar: 5,1512 arredonda para 5, e o "5%"
    // desta frase passaria por essa porta em vez de pela que o teste mede.
    const nada = new Set<string>();

    const check = checkGrounding('A meta do Banco Central e de 3% a 5% ao ano.', nada);
    assert.equal(check.ok, false);
    assert.deepEqual(check.unsupported, ['3', '5']);

    assert.equal(checkGrounding('A alta foi de 2 p.p. no periodo.', nada).ok, false);
    assert.equal(checkGrounding('O dolar subiu para R$ 6.', nada).ok, false);

    // E o outro lado da regra: sem unidade colada, continua sendo linguagem.
    assert.equal(checkGrounding('Os 3 indicadores de juros seguem estaveis.', nada).ok, true);
  });
});

describe('collectNumbers', () => {
  it('percorre estruturas aninhadas', () => {
    const encontrados = collectNumbers({ a: [{ b: 42 }], c: 'valor 7,5' });
    assert.equal(encontrados.has('42'), true);
    assert.equal(encontrados.has('7.5'), true);
  });

  it('registra o modulo de valores negativos', () => {
    const encontrados = collectNumbers({ variacao: -0.2189 });
    assert.equal(encontrados.has('-0.2189'), true);
    assert.equal(encontrados.has('0.2189'), true);
  });
});
