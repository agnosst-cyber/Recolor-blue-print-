"use strict";
// Плагин для перекрашивания объектов в оттенки голубого цвета #2A7DC7
// Базовый голубой цвет #2A7DC7 в RGB (нормализованный)
const baseColor = {
    r: 42 / 255, // 0.1647
    g: 125 / 255, // 0.4902
    b: 199 / 255 // 0.7804
};
// Функция для рекурсивного перекрашивания всех узлов
function recolorNode(node) {
    // Проверяем, есть ли у узла свойство fills (заливка)
    if ('fills' in node && Array.isArray(node.fills)) {
        // Создаем новую заливку голубым цветом
        node.fills = [{
                type: 'SOLID',
                color: baseColor
            }];
    }
    // Проверяем, есть ли у узла свойство strokes (обводка)
    if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
        node.strokes = [{
                type: 'SOLID',
                color: baseColor
            }];
    }
    // Если узел имеет дочерние элементы, рекурсивно обрабатываем их
    if ('children' in node) {
        for (const child of node.children) {
            recolorNode(child);
        }
    }
}
// Показываем UI с шириной 320px
figma.showUI(__html__, { width: 320, height: 200 });
// Обработчик сообщений от UI
figma.ui.onmessage = (msg) => {
    if (msg.type === 'resize' && msg.height) {
        // Автоматическая подстройка высоты под контент
        figma.ui.resize(320, msg.height);
    }
    if (msg.type === 'recolor') {
        const selection = figma.currentPage.selection;
        if (selection.length === 0) {
            figma.notify('Пожалуйста, выделите фрейм, объект или группу');
            return;
        }
        // Перекрашиваем все выделенные объекты
        for (const node of selection) {
            recolorNode(node);
        }
        figma.notify(`Перекрашено объектов: ${selection.length}`);
    }
    if (msg.type === 'cancel') {
        figma.closePlugin();
    }
};
