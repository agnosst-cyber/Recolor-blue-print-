"use strict";
// Плагин для перекрашивания объектов в оттенки голубого цвета #2A7DC7
// Базовый голубой цвет #2A7DC7 в RGB (нормализованный)
const baseColorRGB = {
    r: 42 / 255, // 0.1647
    g: 125 / 255, // 0.4902
    b: 199 / 255 // 0.7804
};
// Конвертация RGB в HSL
function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }
    return { h, s, l };
}
// Конвертация HSL в RGB
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l; // achromatic
    }
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0)
                t += 1;
            if (t > 1)
                t -= 1;
            if (t < 1 / 6)
                return p + (q - p) * 6 * t;
            if (t < 1 / 2)
                return q;
            if (t < 2 / 3)
                return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r, g, b };
}
// Получение яркости цвета (для сортировки объектов)
function getLuminance(r, g, b) {
    // Формула относительной яркости (WCAG)
    const [rs, gs, bs] = [r, g, b].map(c => {
        c = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        return c;
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
// Сбор всех объектов с их исходными цветами
function collectNodes(node, nodes) {
    let originalLuminance = 0.5; // По умолчанию средняя яркость
    let hasFill = false;
    let hasStroke = false;
    // Получаем яркость из заливки, если она есть
    if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
        const fill = node.fills[0];
        if (fill.type === 'SOLID' && fill.color) {
            const { r, g, b } = fill.color;
            originalLuminance = getLuminance(r, g, b);
            hasFill = true;
        }
    }
    // Если нет заливки, проверяем обводку
    if (!hasFill && 'strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
        const stroke = node.strokes[0];
        if (stroke.type === 'SOLID' && stroke.color) {
            const { r, g, b } = stroke.color;
            originalLuminance = getLuminance(r, g, b);
            hasStroke = true;
        }
    }
    // Добавляем узел в список, если у него есть цвет
    if (hasFill || hasStroke) {
        nodes.push({ node, originalLuminance, hasFill, hasStroke });
    }
    // Рекурсивно обрабатываем дочерние элементы
    if ('children' in node) {
        for (const child of node.children) {
            collectNodes(child, nodes);
        }
    }
}
// Перекрашивание объектов с сохранением различимости
function recolorWithShades(selection) {
    // Собираем все объекты с их исходными цветами
    const nodesToRecolor = [];
    for (const node of selection) {
        collectNodes(node, nodesToRecolor);
    }
    if (nodesToRecolor.length === 0) {
        figma.notify('Не найдено объектов с цветами для перекрашивания');
        return;
    }
    // Сортируем объекты по исходной яркости
    nodesToRecolor.sort((a, b) => a.originalLuminance - b.originalLuminance);
    // Конвертируем базовый цвет в HSL
    const baseHSL = rgbToHsl(baseColorRGB.r, baseColorRGB.g, baseColorRGB.b);
    // Создаем палитру оттенков с разной яркостью
    // Используем широкий диапазон для создания очень светлых оттенков (как в примере #E0F2F7)
    const minLightness = 0.10; // Минимальная яркость (темный оттенок)
    const maxLightness = 0.95; // Максимальная яркость (очень светлый оттенок, как фон в примере)
    const lightnessRange = maxLightness - minLightness;
    // Перекрашиваем каждый объект в соответствующий оттенок
    nodesToRecolor.forEach((nodeInfo, index) => {
        // Распределяем оттенки равномерно по яркости
        // Используем индекс для создания градиента от светлого к темному
        const normalizedIndex = nodesToRecolor.length > 1
            ? index / (nodesToRecolor.length - 1)
            : 0.5;
        // Инвертируем, чтобы более светлые исходные объекты получали более светлые оттенки
        const lightness = maxLightness - (normalizedIndex * lightnessRange);
        // Для очень светлых оттенков уменьшаем насыщенность (как в примере #E0F2F7)
        // Это создает более естественные пастельные оттенки
        let saturation = baseHSL.s;
        if (lightness > 0.85) {
            // Для очень светлых оттенков уменьшаем насыщенность до 20-30%
            saturation = baseHSL.s * (0.2 + (0.85 - lightness) * 0.1);
        }
        else if (lightness < 0.25) {
            // Для очень темных оттенков немного увеличиваем насыщенность для контраста
            saturation = Math.min(1, baseHSL.s * 1.1);
        }
        // Создаем оттенок с сохранением hue и адаптированной saturation
        const shadeRGB = hslToRgb(baseHSL.h, saturation, lightness);
        const shadeColor = {
            r: Math.max(0, Math.min(1, shadeRGB.r)),
            g: Math.max(0, Math.min(1, shadeRGB.g)),
            b: Math.max(0, Math.min(1, shadeRGB.b))
        };
        // Применяем цвет к заливке
        if (nodeInfo.hasFill && 'fills' in nodeInfo.node && Array.isArray(nodeInfo.node.fills)) {
            nodeInfo.node.fills = [{
                    type: 'SOLID',
                    color: shadeColor
                }];
        }
        // Применяем цвет к обводке
        if (nodeInfo.hasStroke && 'strokes' in nodeInfo.node && Array.isArray(nodeInfo.node.strokes) && nodeInfo.node.strokes.length > 0) {
            nodeInfo.node.strokes = [{
                    type: 'SOLID',
                    color: shadeColor
                }];
        }
    });
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
        // Перекрашиваем все выделенные объекты в разные оттенки
        recolorWithShades(selection);
        // Подсчитываем количество перекрашенных объектов
        let coloredCount = 0;
        function countColored(node) {
            if (('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) ||
                ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0)) {
                coloredCount++;
            }
            if ('children' in node) {
                for (const child of node.children) {
                    countColored(child);
                }
            }
        }
        for (const node of selection) {
            countColored(node);
        }
        figma.notify(`Перекрашено объектов: ${coloredCount}`);
    }
    if (msg.type === 'cancel') {
        figma.closePlugin();
    }
};
