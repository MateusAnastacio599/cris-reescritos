// Conteúdo e definições originais preservados de CRIS-Campaign-Director-Prototype.zip.
export const originalCampaign = {
  id: 'reescritos',
  pages: [{
    id: 'sao-martinho',
    title: 'Casa São Martinho',
    scenes: [
      {
        id:'quarto', title:'O Quarto', label:'01 // O QUARTO',
        markdown:`# CASA SÃO MARTINHO — O QUARTO

*Íris...*

*Escuro… Primeiro vem o cheiro da terra molhada e da chuva batendo contra a janela, um rangido lento, quase rítmico, da madeira velha.*

*Você enxerga uma fagulha trêmula e amarela. Camas de ferro ocupam o quarto. Várias crianças dormem ali, encolhidas nos seus cobertores ásperos e pesados.*

*Você está sentada em uma das camas. Seus pés não alcançam o chão. Seu corpo parece estranhamente pequeno.*

*Ao seu lado uma garotinha segura uma vela com as duas mãos. Ela parece aliviada quando percebe seus olhos abertos.*

> — Maelle?

**Pausa. Pergunte: “O que você faz?”**

## JANELA

*A chuva escorre pelo vidro e distorce o pátio do orfanato. Do outro lado existe outra ala do prédio.*

*Uma das janelas está iluminada por um amarelo muito mais intenso que o restante do orfanato.*

*Você sabe exatamente qual sala é.*

*O escritório. Fim do corredor. À esquerda. E você não faz ideia de como sabe disso.*

[[cue:fechadura|SOM DA FECHADURA]]

> — Foi lá de novo?

[[note:A primeira badalada fica como trigger manual caso a cena trave ou Maelle insista demais buscando respostas.]]

[[cue:sino|PRIMEIRA BADALADA]]`,
        layers:[
          {id:'rain',name:'Chuva na janela',type:'LOOP',src:'assets/audio/rain-demo.wav',volume:.42},
          {id:'room',name:'Madeira antiga',type:'LOOP',src:'assets/audio/roomtone-demo.wav',volume:.11}
        ],
        triggers:[
          {id:'fechadura',name:'Fechadura',key:'3',src:'assets/audio/door-demo.wav'},
          {id:'sino',name:'Sino',key:'1',src:'assets/audio/bell-demo.wav'},
          {id:'trovao',name:'Trovão',key:'2',src:'assets/audio/thunder-demo.wav'}
        ],
        timeline:[{at:32,label:'Rangido distante',action:'oneshot',src:'assets/audio/door-demo.wav'}]
      },
      {
        id:'corredor', title:'O Corredor', label:'02 // O CORREDOR',
        markdown:`# O CORREDOR

*A luz da vela invade o lado de fora da porta. Um corredor estreito, comprido e antigo aparece diante de vocês, com portas dos dois lados e paredes tomadas pela umidade.*

> — Maelle, anda logo!

**Você vai com ela?**

## PEGADAS

*Pequenas marcas úmidas começam alguns metros depois do quarto. São pegadas pequenas e descalças. Elas seguem exatamente na direção do escritório.*

*Misturados à água existem poucos grãos escuros que refletem dourado quando a vela passa sobre eles.*

## DESENHOS

*Casas tortas, animais, famílias, o pátio da São Martinho. Um desenho chama sua atenção: várias crianças lado a lado e um sujeito mais velho atrás delas.*

**LÍVIA — MAELLE — LÉIA — ÍRIS — FELIPE — TIO GIAN**

## UM DESENHO CAÍDO

*Casa São Martinho durante a noite. Todas as janelas escuras, exceto uma pintada com amarelo forte.*

**O escritório.**

[[cue:sino|SEGUNDA BADALADA]]

## O ESCRITÓRIO

*No fim do corredor existe uma porta de madeira escura. Uma pequena fresta separa a porta do batente. Do outro lado, existe uma luz amarela.*

> — Você disse que, se abrisse, a gente tinha que entrar antes que fechasse de novo.

**Pergunte: “O que você faz?”**`,
        layers:[
          {id:'rain',name:'Chuva distante',type:'LOOP',src:'assets/audio/rain-demo.wav',volume:.30},
          {id:'room',name:'Corredor antigo',type:'LOOP',src:'assets/audio/roomtone-demo.wav',volume:.16}
        ],
        triggers:[
          {id:'sino',name:'Sino',key:'1',src:'assets/audio/bell-demo.wav'},
          {id:'trovao',name:'Trovão',key:'2',src:'assets/audio/thunder-demo.wav'},
          {id:'fechadura',name:'Porta / Fechadura',key:'3',src:'assets/audio/door-demo.wav'}
        ],
        timeline:[{at:25,label:'Riser sutil',action:'oneshot',src:'assets/audio/riser-demo.wav'}]
      },
      {
        id:'escritorio', title:'O Escritório', label:'03 // O ESCRITÓRIO',
        markdown:`# DENTRO DO ESCRITÓRIO

*Ao empurrar a porta, ela abre com um rangido baixo. A luz amarela vem de um pequeno abajur sobre a mesa. É forte demais para uma lâmpada tão pequena.*

*O escritório é simples. Uma mesa, armários, alguns livros empilhados e uma janela coberta pela chuva.*

> — Então era isso que você queria ver?

*Mas alguma coisa naquele lugar parece errada: você reconhece a mesa, a janela, até o lugar onde deveria existir uma cadeira. Você nunca esteve aqui. Mas sabe onde tudo fica.*

## A MENINA

*Íris… Você sente um arrepio estranho. Um frio percorrendo seu corpo. Do outro lado da sala, perto da janela, tem uma garotinha.*

*Ela está de costas para vocês, olhando a chuva. Tem praticamente a sua altura, o mesmo corpo pequeno, o mesmo vestido.*

*Ela vira lentamente o rosto na sua direção e sorri.*

> — Mi! Você finalmente voltou.

**Pausa. Deixe Maelle reagir.**

## A TERCEIRA BADALADA

*A garotinha na janela deixa de sorrir. Seus olhos se desviam lentamente para a parede atrás de vocês.*

*A luz amarela do abajur começa a oscilar.*

*Uma vez. Duas. Três…*

[[cue:terceira|TERCEIRA BADALADA // CUE COMPLETA]]

*O som da chuva desaparece. Não diminui. Desaparece.*

*Por um segundo você sabe exatamente o que existe atrás daquela parede. No segundo seguinte, não sabe mais.*

*A chuva sobe. Lívia grita seu nome. Você sente dedos apertando seu braço.*

*Distante, amarelo.*

*Você já esteve ali. Não… Você ainda vai estar.*

*Você ouve areia caindo. Lívia de joelhos, lutando para respirar.*

*Uma mão pequena contra a parede. Sangue entre os dedos. Uma curva. Outra.*

**Você conhece esse símbolo. Não, você ainda não deveria conhecer.**

*Sangue. Areia. Amarelo.*

*E por um único segundo você tem certeza absoluta de que fez alguma coisa terrível.*

---

**Íris. Você abre os olhos.**`,
        layers:[
          {id:'rain',name:'Chuva forte',type:'LOOP',src:'assets/audio/rain-demo.wav',volume:.48},
          {id:'room',name:'Escritório / Madeira',type:'LOOP',src:'assets/audio/roomtone-demo.wav',volume:.09}
        ],
        triggers:[
          {id:'sino',name:'Sino',key:'1',src:'assets/audio/bell-demo.wav'},
          {id:'trovao',name:'Trovão',key:'2',src:'assets/audio/thunder-demo.wav'},
          {id:'porta',name:'Porta',key:'3',src:'assets/audio/door-demo.wav'},
          {id:'terceira',name:'Terceira Badalada',key:'4',cue:true}
        ],
        timeline:[
          {at:22,label:'Riser tenso',action:'oneshot',src:'assets/audio/riser-demo.wav'},
          {at:35,label:'Chuva → 24%',action:'fade',layer:'rain',to:.24,duration:4}
        ]
      }
    ]
  }]
};
