"use strict";
var edaEsbuildExportName = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    about: () => about,
    activate: () => activate,
    batchPlaceFootprint: () => batchPlaceFootprint,
    batchPlaceSymbol: () => batchPlaceSymbol,
    openLibrarySelector: () => openLibrarySelector
  });
  function activate(status, arg) {
  }
  async function openLibrarySelector() {
    await eda.sys_IFrame.openIFrame("/iframe/library-selector.html", 400, 200);
  }
  async function getSelectedLibraryUuid() {
    try {
      const selectedLibraryType = await eda.sys_Storage.getExtensionUserConfig("selectedLibraryType");
      switch (selectedLibraryType) {
        case "personal":
          return await eda.lib_LibrariesList.getPersonalLibraryUuid();
        case "project":
          return await eda.lib_LibrariesList.getProjectLibraryUuid();
        case "other":
          const specificLibraryUuid = await eda.sys_Storage.getExtensionUserConfig("selectedSpecificLibraryUuid");
          if (specificLibraryUuid) {
            return specificLibraryUuid;
          }
          return await eda.lib_LibrariesList.getSystemLibraryUuid();
        case "system":
        default:
          return await eda.lib_LibrariesList.getSystemLibraryUuid();
      }
    } catch (error) {
      return await eda.lib_LibrariesList.getSystemLibraryUuid();
    }
  }
  async function batchPlaceSymbol() {
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
    if (!file || typeof file.text !== "function") {
      return;
    }
    const csvContent = await file.text();
    await placeSymbolsFromCSV(csvContent);
  }
  async function batchPlaceFootprint() {
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
    if (!file || typeof file.text !== "function") {
      return;
    }
    const csvContent = await file.text();
    await placeFootprintsFromCSV(csvContent);
  }
  function convertToMil(value, unit) {
    switch (unit.toLowerCase()) {
      case "mm":
        return value * 39.3701;
      // 1mm = 39.3701mil
      case "mil":
        return value;
      case "inch":
        return value * 1e3;
      // 1inch = 1000mil
      default:
        return value;
    }
  }
  function convertToInch(value, unit) {
    switch (unit.toLowerCase()) {
      case "mm":
        return value * 0.0393701;
      // 1mm = 0.0393701inch
      case "mil":
        return value * 1e-3;
      // 1mil = 0.001inch
      case "inch":
        return value;
      default:
        return value;
    }
  }
  function parseCSVWithCoordinates(csvContent, targetUnit = "mil") {
    const lines = csvContent.trim().split("\n");
    const components = [];
    let xUnit = "";
    let yUnit = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const columns = line.split(",").map((col) => col.trim().replace(/"/g, ""));
      if (i === 0) {
        const firstColumn = columns[0].toLowerCase();
        if (firstColumn.includes("name") || firstColumn.includes("\u540D\u79F0") || firstColumn.includes("\u5C01\u88C5") || firstColumn.includes("component")) {
          if (columns.length >= 3) {
            const xHeader = columns[1].toLowerCase();
            if (xHeader.includes("mm")) xUnit = "mm";
            else if (xHeader.includes("mil")) xUnit = "mil";
            else if (xHeader.includes("inch")) xUnit = "inch";
            const yHeader = columns[2].toLowerCase();
            if (yHeader.includes("mm")) yUnit = "mm";
            else if (yHeader.includes("mil")) yUnit = "mil";
            else if (yHeader.includes("inch")) yUnit = "inch";
          }
          continue;
        }
      }
      if (columns.length >= 3) {
        const name = columns[0];
        const x = parseFloat(columns[1]);
        const y = parseFloat(columns[2]);
        if (!isNaN(x) && !isNaN(y)) {
          let convertedX, convertedY;
          if (targetUnit === "mil") {
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
  async function placeFootprintsFromCSV(csvContent) {
    const footprints = parseCSVWithCoordinates(csvContent, "mil");
    if (footprints.length === 0) {
      eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text("No valid footprint data found in CSV file"));
      return;
    }
    let successCount = 0;
    let failedCount = 0;
    const failedItems = [];
    try {
      eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text("Found ${1} footprints, starting placement...", void 0, void 0, footprints.length));
      for (let index = 0; index < footprints.length; index++) {
        const item = footprints[index];
        try {
          const libUuid = await getSelectedLibraryUuid();
          const footprintResult = await eda.lib_Footprint.search(item.name, libUuid);
          const deviceResult = await eda.lib_Device.search(item.name, libUuid);
          if (!footprintResult || footprintResult.length === 0) {
            failedCount++;
            failedItems.push(eda.sys_I18n.text("Footprint not found: ${1}", void 0, void 0, item.name));
            continue;
          }
          if (!deviceResult || deviceResult.length === 0) {
            failedCount++;
            failedItems.push(eda.sys_I18n.text("Device not found: ${1}", void 0, void 0, item.name));
            continue;
          }
          let selectedFootprint = null;
          let selectedDevice = null;
          for (const fp of footprintResult) {
            if (fp.name === item.name) {
              selectedFootprint = fp;
              break;
            }
          }
          if (!selectedFootprint) {
            failedCount++;
            failedItems.push(eda.sys_I18n.text("Footprint name mismatch: ${1}", void 0, void 0, item.name));
            continue;
          }
          for (const dev of deviceResult) {
            if (dev.footprintName === item.name) {
              selectedDevice = dev;
              break;
            }
          }
          if (!selectedDevice) {
            failedCount++;
            failedItems.push(eda.sys_I18n.text("Device footprint name mismatch: ${1}", void 0, void 0, item.name));
            continue;
          }
          await eda.pcb_PrimitiveComponent.create(
            { libraryUuid: libUuid, uuid: selectedDevice.uuid },
            1,
            // EPCB_LayerId.TOP
            item.x,
            item.y
          );
          successCount++;
          if (index % 10 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        } catch (error) {
          failedCount++;
          failedItems.push(`${item.name}: ${error.message}`);
        }
      }
      if (failedItems.length > 0) {
        eda.sys_Log.add(eda.sys_I18n.text("Batch footprint placement failure details (${1} items):", void 0, void 0, failedItems.length));
        failedItems.forEach((item) => {
          eda.sys_Log.add(`  ${item}`);
        });
      }
      eda.sys_Dialog.showInformationMessage(
        eda.sys_I18n.text("Batch placement completed! Success: ${1}, Failed: ${2}", void 0, void 0, successCount, failedCount) + (failedItems.length > 0 ? eda.sys_I18n.text("\n\nSee log panel for detailed failure info") : "")
      );
    } catch (error) {
      eda.sys_Message.showToastMessage(eda.sys_I18n.text("Error during batch placement: ${1}", void 0, void 0, error.message), "error");
    }
  }
  async function placeSymbolsFromCSV(csvContent) {
    const symbols = parseCSVWithCoordinates(csvContent, "inch");
    if (symbols.length === 0) {
      eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text("No valid symbol data found in CSV file"));
      return;
    }
    let successCount = 0;
    let failedCount = 0;
    const failedItems = [];
    try {
      eda.sys_Dialog.showInformationMessage(eda.sys_I18n.text("Found ${1} symbols, starting placement...", void 0, void 0, symbols.length));
      for (let index = 0; index < symbols.length; index++) {
        const item = symbols[index];
        try {
          const libUuid = await getSelectedLibraryUuid();
          const symbolResult = await eda.lib_Symbol.search(item.name, libUuid);
          const deviceResult = await eda.lib_Device.search(item.name, libUuid);
          if (!symbolResult || symbolResult.length === 0) {
            failedCount++;
            failedItems.push(eda.sys_I18n.text("Symbol not found: ${1}", void 0, void 0, item.name));
            continue;
          }
          if (!deviceResult || deviceResult.length === 0) {
            failedCount++;
            failedItems.push(eda.sys_I18n.text("Device not found: ${1}", void 0, void 0, item.name));
            continue;
          }
          let selectedSymbol = null;
          let selectedDevice = null;
          for (const sym of symbolResult) {
            if (sym.name === item.name) {
              selectedSymbol = sym;
              break;
            }
          }
          if (!selectedSymbol) {
            failedCount++;
            failedItems.push(eda.sys_I18n.text("Symbol name mismatch: ${1}", void 0, void 0, item.name));
            continue;
          }
          for (const dev of deviceResult) {
            if (dev.symbolName === item.name) {
              selectedDevice = dev;
              break;
            }
          }
          if (!selectedDevice) {
            failedCount++;
            failedItems.push(eda.sys_I18n.text("Device symbol name mismatch: ${1}", void 0, void 0, item.name));
            continue;
          }
          await eda.sch_PrimitiveComponent.create(
            { libraryUuid: libUuid, uuid: selectedDevice.uuid },
            item.x * 100,
            item.y * 100
          );
          successCount++;
          if (index % 10 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        } catch (error) {
          failedCount++;
          failedItems.push(`${item.name}: ${error.message}`);
        }
      }
      if (failedItems.length > 0) {
        eda.sys_Log.add(eda.sys_I18n.text("Batch symbol placement failure details (${1} items):", void 0, void 0, failedItems.length));
        failedItems.forEach((item) => {
          eda.sys_Log.add(`  ${item}`);
        });
      }
      eda.sys_Dialog.showInformationMessage(
        eda.sys_I18n.text("Batch symbol placement completed! Success: ${1}, Failed: ${2}", void 0, void 0, successCount, failedCount) + (failedItems.length > 0 ? eda.sys_I18n.text("\n\nSee log panel for detailed failure info") : "")
      );
    } catch (error) {
      eda.sys_Message.showToastMessage(eda.sys_I18n.text("Error during batch symbol placement: ${1}", void 0, void 0, error.message), "error");
    }
  }
  function about() {
    eda.sys_Dialog.showInformationMessage(
      eda.sys_I18n.text("Batch Place Components v1.1.0") + "\n\n" + eda.sys_I18n.text("Batch place components tool with CSV import and smart unit conversion.") + "\n\n" + eda.sys_I18n.text("Features:") + "\n" + eda.sys_I18n.text("- Batch place PCB footprints (auto mm/mil conversion)") + "\n" + eda.sys_I18n.text("- Batch place schematic symbols (auto inch/mm conversion)") + "\n" + eda.sys_I18n.text("- Smart unit detection from CSV headers") + "\n" + eda.sys_I18n.text("- Auto unit conversion to match EDA internal coordinate system") + "\n\n" + eda.sys_I18n.text("CSV format example:") + "\nName,X(mm),Y(mm)\n\u5143\u4EF6\u540D\u79F0,\u5750\u6807\u503C,\u5750\u6807\u503C"
    );
  }
  return __toCommonJS(src_exports);
})();
