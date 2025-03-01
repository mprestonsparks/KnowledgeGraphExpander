import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Build Assets', () => {
  it('should generate all required assets in dist folder', () => {
    const distPath = path.resolve(__dirname, '../../../dist');
    const files = fs.readdirSync(distPath);
    
    // Check for index.html
    expect(files).toContain('index.html');
    
    // Check for assets directory
    expect(files).toContain('assets');
    
    // Check assets directory contents
    const assetsPath = path.join(distPath, 'assets');
    const assetFiles = fs.readdirSync(assetsPath);
    
    // Should have at least one JS and CSS file
    expect(assetFiles.some(file => file.endsWith('.js'))).toBe(true);
    expect(assetFiles.some(file => file.endsWith('.css'))).toBe(true);
  });
});
