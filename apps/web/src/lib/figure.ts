// 题目配图：模板渲染器已上移到共享包（@workbench/shared/figure），
// 前端（题库/练习/打印）与后端（拍照分析原题还原入库）共用同一份 specToSvg，保证图完全一致
export { specToSvg, figureHtml } from '@workbench/shared'
