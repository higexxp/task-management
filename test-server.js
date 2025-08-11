const express = require('express');

const app = express();
const port = 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Test server is running' });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'GitHub Task Extension API - Test Mode',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      metadata: '/api/metadata',
    },
  });
});

app.get('/api/metadata/options', (req, res) => {
  res.json({
    success: true,
    data: {
      priority: ['low', 'medium', 'high', 'critical'],
      category: ['frontend', 'backend', 'design', 'testing', 'docs'],
      estimatedSize: ['xs', 'small', 'medium', 'large', 'xl'],
      status: ['todo', 'in-progress', 'review', 'done'],
      timeSpent: ['none', '0-2h', '2-4h', '4-8h', '8h+'],
    },
  });
});

// Get all required labels
app.get('/api/metadata/labels', (req, res) => {
  const labels = [];
  
  // Priority labels
  ['low', 'medium', 'high', 'critical'].forEach(priority => {
    labels.push({
      name: `priority:${priority}`,
      color: priority === 'low' ? '0E8A16' : priority === 'medium' ? 'FBCA04' : priority === 'high' ? 'D93F0B' : 'B60205',
      description: `Priority: ${priority}`
    });
  });
  
  // Category labels
  ['frontend', 'backend', 'design', 'testing', 'docs'].forEach(category => {
    labels.push({
      name: `category:${category}`,
      color: category === 'frontend' ? '1D76DB' : category === 'backend' ? '0052CC' : category === 'design' ? 'E99695' : category === 'testing' ? '5319E7' : '006B75',
      description: `Category: ${category}`
    });
  });
  
  // Size labels
  ['xs', 'small', 'medium', 'large', 'xl'].forEach(size => {
    labels.push({
      name: `size:${size}`,
      color: size === 'xs' ? 'C2E0C6' : size === 'small' ? '7057FF' : size === 'medium' ? 'FBCA04' : size === 'large' ? 'D93F0B' : 'B60205',
      description: `Estimated size: ${size}`
    });
  });
  
  res.json({
    success: true,
    data: labels,
    count: labels.length,
  });
});

// Extract metadata from labels
app.post('/api/metadata/extract', (req, res) => {
  const { labels } = req.body;
  
  if (!Array.isArray(labels)) {
    return res.status(400).json({
      success: false,
      error: 'Labels must be an array',
    });
  }
  
  const metadata = {
    priority: 'medium',
    category: 'backend',
    estimatedSize: 'medium',
    status: 'todo',
  };
  
  // Extract metadata from labels
  labels.forEach(label => {
    const labelName = typeof label === 'string' ? label : label.name;
    if (labelName.startsWith('priority:')) {
      metadata.priority = labelName.split(':')[1];
    } else if (labelName.startsWith('category:')) {
      metadata.category = labelName.split(':')[1];
    } else if (labelName.startsWith('size:')) {
      metadata.estimatedSize = labelName.split(':')[1];
    } else if (labelName.startsWith('status:')) {
      metadata.status = labelName.split(':')[1];
    }
  });
  
  res.json({
    success: true,
    data: {
      labels,
      extractedMetadata: metadata,
    },
  });
});

app.listen(port, () => {
  console.log(`✅ Test server running on http://localhost:${port}`);
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /api');
  console.log('  GET  /api/metadata/options');
  console.log('  GET  /api/metadata/labels');
  console.log('  POST /api/metadata/extract');
});