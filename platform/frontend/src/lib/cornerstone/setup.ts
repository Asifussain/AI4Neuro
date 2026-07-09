'use client';

import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import dicomParser from 'dicom-parser';

let isInitialized = false;

export async function initCornerstone() {
  if (isInitialized) {
    return;
  }

  try {
    // Initialize Cornerstone
    await cornerstone.init();

    // Configure DICOM Image Loader
    // Note: Using type assertion due to Cornerstone library type definitions
    (cornerstoneDICOMImageLoader as any).external.cornerstone = cornerstone;
    (cornerstoneDICOMImageLoader as any).external.dicomParser = dicomParser;

    // Configure web worker
    (cornerstoneDICOMImageLoader as any).webWorkerManager.initialize({
      maxWebWorkers: navigator.hardwareConcurrency || 4,
      startWebWorkersOnDemand: true,
      taskConfiguration: {
        decodeTask: {
          initializeCodecsOnStartup: true,
        },
      },
    });

    // Initialize tools
    cornerstoneTools.init();

    // Add tools (using type assertion for tools that may not be in type definitions)
    const tools = cornerstoneTools as any;
    cornerstoneTools.addTool(tools.PanTool);
    cornerstoneTools.addTool(tools.ZoomTool);
    if (tools.StackScrollMouseWheelTool) cornerstoneTools.addTool(tools.StackScrollMouseWheelTool);
    if (tools.WindowLevelTool) cornerstoneTools.addTool(tools.WindowLevelTool);
    if (tools.LengthTool) cornerstoneTools.addTool(tools.LengthTool);
    if (tools.AngleTool) cornerstoneTools.addTool(tools.AngleTool);
    if (tools.RectangleROITool) cornerstoneTools.addTool(tools.RectangleROITool);
    if (tools.EllipticalROITool) cornerstoneTools.addTool(tools.EllipticalROITool);
    if (tools.ArrowAnnotateTool) cornerstoneTools.addTool(tools.ArrowAnnotateTool);

    isInitialized = true;
    console.log('Cornerstone initialized successfully');
  } catch (error) {
    console.error('Error initializing Cornerstone:', error);
    throw error;
  }
}

export function getCornerstone() {
  return cornerstone;
}

export function getCornerstoneTools() {
  return cornerstoneTools;
}
