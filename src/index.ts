/**
 * 入口文件
 *
 * 本文件为默认扩展入口文件，如果你想要配置其它文件作为入口文件，
 * 请修改 `extension.json` 中的 `entry` 字段；
 *
 * 请在此处使用 `export`  导出所有你希望在 `headerMenus` 中引用的方法，
 * 方法通过方法名与 `headerMenus` 关联。
 *
 * 如需了解更多开发细节，请阅读：
 * https://prodocs.lceda.cn/cn/api/guide/
 */
/* eslint-disable no-template-curly-in-string */ // i18n placeholders use ${1} format intentionally
import * as extensionConfig from '../extension.json';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(status?: 'onStartupFinished', arg?: string): void {}

// 打开库选择器
export async function openLibrarySelector(): Promise<void> {
        await eda.sys_IFrame.openIFrame('/iframe/library-selector.html', 400, 200);
}

// 获取已选择的库UUID
async function getSelectedLibraryUuid(): Promise<string> {
    try {
        const selectedLibraryType = await eda.sys_Storage.getExtensionUserConfig('selectedLibraryType');
        
        switch (selectedLibraryType) {
            case 'personal':
                return await eda.lib_LibrariesList.getPersonalLibraryUuid();
            case 'project':
                return await eda.lib_LibrariesList.getProjectLibraryUuid();
            case 'other':
                // 对于其他库，从Storage获取用户选择的具体库UUID
                const specificLibraryUuid = await eda.sys_Storage.getExtensionUserConfig('selectedSpecificLibraryUuid');
                if (specificLibraryUuid) {
                    return specificLibraryUuid;
                }
                // 如果没有选择具体库，返回系统库UUID作为默认值
                return await eda.lib_LibrariesList.getSystemLibraryUuid();
            case 'system':
            default:
                return await eda.lib_LibrariesList.getSystemLibraryUuid();
        }
    } catch (error) {
        // 出错时返回系统库UUID
        return await eda.lib_LibrariesList.getSystemLibraryUuid();
    }
}

// 批量放置符号主函数
export async function batchPlaceSymbol(): Promise<void> {
	
		// 先读取CSV文件
		const fileResult = await eda.sys_FileSystem.openReadFileDialog();
		
		if (!fileResult) {
			return;
		}
		
		let file;
		if (Array.isArray(fileResult)) {
			if (fileResult.length === 0) {
				return;
			}
			file = fileResult[0];
		} else {
			file = fileResult;
		}
		
		if (!file || typeof file.text !== 'function') {
			return;
		}
		
		const csvContent = await file.text();
		
		// 解析CSV内容并直接放置符号
		await placeSymbolsFromCSV(csvContent);
	
}

// 批量放置封装主函数
export async function batchPlaceFootprint(): Promise<void> {
	
		// 先读取CSV文件
		const fileResult = await eda.sys_FileSystem.openReadFileDialog();
		
		if (!fileResult) {
			return;
		}
		
		let file;
		if (Array.isArray(fileResult)) {
			if (fileResult.length === 0) {
				return;
			}
			file = fileResult[0];
		} else {
			file = fileResult;
		}
		
		if (!file || typeof file.text !== 'function') {
			return;
		}
		
		const csvContent = await file.text();
		
		// 解析CSV内容并直接放置封装
		await placeFootprintsFromCSV(csvContent);
	
}

// 单位转换函数
function convertToMil(value: number, unit: string): number {
    switch (unit.toLowerCase()) {
        case 'mm':
            return value * 39.3701; // 1mm = 39.3701mil
        case 'mil':
            return value;
        case 'inch':
            return value * 1000; // 1inch = 1000mil
        default:
            return value; // 默认假设为mil
    }
}

function convertToInch(value: number, unit: string): number {
    switch (unit.toLowerCase()) {
        case 'mm':
            return value * 0.0393701; // 1mm = 0.0393701inch
        case 'mil':
            return value * 0.001; // 1mil = 0.001inch
        case 'inch':
            return value;
        default:
            return value; // 默认假设为inch
    }
}

// 解析CSV文件内容（支持名称,坐标格式，兼容表头和单位转换）
function parseCSVWithCoordinates(csvContent: string, targetUnit: 'mil' | 'inch' = 'mil'): Array<{name: string, x: number, y: number}> {
    const lines = csvContent.trim().split('\n');
    const components = [];
    let xUnit = '';
    let yUnit = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
        
        // 检查是否为表头行并提取单位信息
        if (i === 0) {
            const firstColumn = columns[0].toLowerCase();
            if (firstColumn.includes('name') || firstColumn.includes('名称') || 
                firstColumn.includes('封装') || firstColumn.includes('component')) {
                // 从表头提取单位信息
                if (columns.length >= 3) {
                    // 提取X坐标单位
                    const xHeader = columns[1].toLowerCase();
                    if (xHeader.includes('mm')) xUnit = 'mm';
                    else if (xHeader.includes('mil')) xUnit = 'mil';
                    else if (xHeader.includes('inch')) xUnit = 'inch';
                    
                    // 提取Y坐标单位
                    const yHeader = columns[2].toLowerCase();
                    if (yHeader.includes('mm')) yUnit = 'mm';
                    else if (yHeader.includes('mil')) yUnit = 'mil';
                    else if (yHeader.includes('inch')) yUnit = 'inch';
                }
                continue; // 跳过表头行
            }
        }
        
        // 支持格式：元件名称,X坐标,Y坐标
        if (columns.length >= 3) {
            const name = columns[0];
            const x = parseFloat(columns[1]);
            const y = parseFloat(columns[2]);
            
            if (!isNaN(x) && !isNaN(y)) {
                // 根据目标单位进行转换
                let convertedX, convertedY;
                if (targetUnit === 'mil') {
                    convertedX = convertToMil(x, xUnit);
                    convertedY = convertToMil(y, yUnit);
                } else {
                    convertedX = convertToInch(x, xUnit);
                    convertedY = convertToInch(y, yUnit);
                }
                
                components.push({ name, x: convertedX, y: convertedY });
            }
        }
    }
    
    return components;
}



// 根据CSV内容直接放置封装
async function placeFootprintsFromCSV(csvContent: string): Promise<void> {
    const footprints = parseCSVWithCoordinates(csvContent, 'mil'); // PCB使用mil作为内部单位
    
    if (footprints.length === 0) {
        eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('No valid footprint data found in CSV file'));
        return;
    }
    
    let successCount = 0;
    let failedCount = 0;
    const failedItems: string[] = [];
    
    try {
        eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('Found ${1} footprints, starting placement...', undefined, undefined, footprints.length));
        
        for (let index = 0; index < footprints.length; index++) {
            const item = footprints[index];
            
            try {
                // 搜索封装和器件
                const libUuid = await getSelectedLibraryUuid();
                
                const footprintResult = await eda.lib_Footprint.search(item.name, libUuid);
                const deviceResult = await eda.lib_Device.search(item.name, libUuid);
                
                if (!footprintResult || footprintResult.length === 0) {
                    failedCount++;
                    failedItems.push(eda.sys_I18n.text('Footprint not found: ${1}', undefined, undefined, item.name));
                    continue;
                }
                
                if (!deviceResult || deviceResult.length === 0) {
                    failedCount++;
                    failedItems.push(eda.sys_I18n.text('Device not found: ${1}', undefined, undefined, item.name));
                    continue;
                }

                // 必须完全匹配名称
                let selectedFootprint = null;
                let selectedDevice = null;

                // 查找完全匹配的封装
                for (const fp of footprintResult) {
                    if (fp.name === item.name) {
                        selectedFootprint = fp;
                        break;
                    }
                }

                if (!selectedFootprint) {
                    failedCount++;
                    failedItems.push(eda.sys_I18n.text('Footprint name mismatch: ${1}', undefined, undefined, item.name));
                    continue;
                }
                
                // 查找完全匹配的器件（通过footprintName匹配）
                for (const dev of deviceResult) {
                    if (dev.footprintName === item.name) {
                        selectedDevice = dev;
                        break;
                    }
                }
                
                if (!selectedDevice) {
                    failedCount++;
                    failedItems.push(eda.sys_I18n.text('Device footprint name mismatch: ${1}', undefined, undefined, item.name));
                    continue;
                }
                
                // 直接在指定坐标创建器件
                await eda.pcb_PrimitiveComponent.create(
                    {libraryUuid: libUuid, uuid: selectedDevice.uuid}, 
                    1, // EPCB_LayerId.TOP
                    item.x, 
                    item.y
                );
                
                successCount++;
                
                // 添加小延迟以避免界面卡顿
                if (index % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                
            } catch (error) {
                failedCount++;
                failedItems.push(`${item.name}: ${error.message}`);
            }
        }
        
        // 批量放置完成
        // 将失败详情写入日志
        if (failedItems.length > 0) {
            eda.sys_Log.add(eda.sys_I18n.text('Batch footprint placement failure details (${1} items):', undefined, undefined, failedItems.length));
            failedItems.forEach(item => {
                eda.sys_Log.add(`  ${item}`);
            });
        }
        
        // 弹窗只显示简要统计信息
        eda.sys_Dialog.showInformationMessage(
            eda.sys_I18n.text('Batch placement completed! Success: ${1}, Failed: ${2}', undefined, undefined, successCount, failedCount) +
            (failedItems.length > 0 ? eda.sys_I18n.text('\n\nSee log panel for detailed failure info') : '')
        );
        
    } catch (error) {
        eda.sys_Message.showToastMessage(eda.sys_I18n.text('Error during batch placement: ${1}', undefined, undefined, error.message), 'error');
    }
}

// 根据CSV内容直接放置符号
async function placeSymbolsFromCSV(csvContent: string): Promise<void> {
    const symbols = parseCSVWithCoordinates(csvContent, 'inch'); // 原理图使用inch作为内部单位
    
    if (symbols.length === 0) {
        eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('No valid symbol data found in CSV file'));
        return;
    }
    
    let successCount = 0;
    let failedCount = 0;
    const failedItems: string[] = [];
    
    try {
        eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text('Found ${1} symbols, starting placement...', undefined, undefined, symbols.length));
        
        for (let index = 0; index < symbols.length; index++) {
            const item = symbols[index];
            
            try {
                // 搜索符号和器件
                const libUuid = await getSelectedLibraryUuid();
                
                const symbolResult = await eda.lib_Symbol.search(item.name, libUuid);
                const deviceResult = await eda.lib_Device.search(item.name, libUuid);
                
                if (!symbolResult || symbolResult.length === 0) {
                    failedCount++;
                    failedItems.push(eda.sys_I18n.text('Symbol not found: ${1}', undefined, undefined, item.name));
                    continue;
                }
                
                if (!deviceResult || deviceResult.length === 0) {
                    failedCount++;
                    failedItems.push(eda.sys_I18n.text('Device not found: ${1}', undefined, undefined, item.name));
                    continue;
                }

                // 必须完全匹配名称
                let selectedSymbol = null;
                let selectedDevice = null;

                // 查找完全匹配的符号
                for (const sym of symbolResult) {
                    if (sym.name === item.name) {
                        selectedSymbol = sym;
                        break;
                    }
                }

                if (!selectedSymbol) {
                    failedCount++;
                    failedItems.push(eda.sys_I18n.text('Symbol name mismatch: ${1}', undefined, undefined, item.name));
                    continue;
                }

                // 查找完全匹配的器件（通过symbolName匹配）
                for (const dev of deviceResult) {
                    if (dev.symbolName === item.name) {
                        selectedDevice = dev;
                        break;
                    }
                }
                
                if (!selectedDevice) {
                    failedCount++;
                    failedItems.push(eda.sys_I18n.text('Device symbol name mismatch: ${1}', undefined, undefined, item.name));
                    continue;
                }
                
                // 直接在指定坐标创建器件（符号坐标需要放大100倍）
                await eda.sch_PrimitiveComponent.create(
                    {libraryUuid: libUuid, uuid: selectedDevice.uuid}, 
                    item.x * 100, 
                    item.y * 100
                );
                
                successCount++;
                
                // 添加小延迟以避免界面卡顿
                if (index % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                
            } catch (error) {
                failedCount++;
                failedItems.push(`${item.name}: ${error.message}`);
            }
        }
        
        // 批量放置完成
        // 将失败详情写入日志
        if (failedItems.length > 0) {
            eda.sys_Log.add(eda.sys_I18n.text('Batch symbol placement failure details (${1} items):', undefined, undefined, failedItems.length));
            failedItems.forEach(item => {
                eda.sys_Log.add(`  ${item}`);
            });
        }
        
        // 弹窗只显示简要统计信息
        eda.sys_Dialog.showInformationMessage(
            eda.sys_I18n.text('Batch symbol placement completed! Success: ${1}, Failed: ${2}', undefined, undefined, successCount, failedCount) +
            (failedItems.length > 0 ? eda.sys_I18n.text('\n\nSee log panel for detailed failure info') : '')
        );
        
    } catch (error) {
        eda.sys_Message.showToastMessage(eda.sys_I18n.text('Error during batch symbol placement: ${1}', undefined, undefined, error.message), 'error');
    }
}

export function about(): void {
	eda.sys_Dialog.showInformationMessage(
		eda.sys_I18n.text('Batch Place Components v1.1.0') + '\n\n' +
		eda.sys_I18n.text('Batch place components tool with CSV import and smart unit conversion.') + '\n\n' +
		eda.sys_I18n.text('Features:') + '\n' +
		eda.sys_I18n.text('- Batch place PCB footprints (auto mm/mil conversion)') + '\n' +
		eda.sys_I18n.text('- Batch place schematic symbols (auto inch/mm conversion)') + '\n' +
		eda.sys_I18n.text('- Smart unit detection from CSV headers') + '\n' +
		eda.sys_I18n.text('- Auto unit conversion to match EDA internal coordinate system') + '\n\n' +
		eda.sys_I18n.text('CSV format example:') + '\n' +
		'Name,X(mm),Y(mm)\n' +
		'元件名称,坐标值,坐标值',
	);
}
