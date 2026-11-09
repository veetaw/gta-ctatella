export const FARM_LOCATIONS=[
 ['🍇','Vigneto · Fa lu vuin',40.654700,15.411113],
 ['C','Porta l’uva a la grotta',40.655474,15.4039111],
 ['P','Lu patanar · Accatta r patan',40.663491,15.406505],
 ['🐖','Recinto · Crisc lu puorc',40.6547569,15.4109624],
 ['F','Mulino · Fariniello',40.661568,15.404958],
 ['🐣','Pollaio · Scuot i pruciuin',40.6547572,15.4108678],
 ['T','Chianta r patan',40.6545686,15.410701],
 ['S','Semmna r gruan',40.6546858,15.4107017],
];

export function hasPlanted(farm,crop){
 return !!(farm.sown?.[crop]||farm[crop]||(crop==='wheat'?farm.wheatHarvested||farm.wheatDelivered:farm.potatoesStock));
}
