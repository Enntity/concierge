# Inline Applet Specification for LLMs

This document describes how LLMs can generate inline interactive applets in chat.

## Code Block Syntax

The LLM uses a fenced code block with the language tag `applet` (or `html-applet`).

**IMPORTANT**: Attributes like `title`, `url`, and `height` go on the SAME LINE as the language tag (the "info string"), not inside the code block.

## Format 1: Inline HTML with Attributes

The attributes go on the opening fence line, HTML content goes between the fences:

~~~
```applet title="My Calculator" height="400"
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        button { padding: 10px 20px; margin: 5px; cursor: pointer; }
        input { padding: 8px; margin: 5px; }
    </style>
</head>
<body>
    <h1>Simple Calculator</h1>
    <input type="number" id="a" placeholder="Number 1">
    <input type="number" id="b" placeholder="Number 2">
    <button onclick="add()">Add</button>
    <button onclick="subtract()">Subtract</button>
    <p>Result: <span id="result">-</span></p>
    <script>
        function add() {
            const a = parseFloat(document.getElementById('a').value) || 0;
            const b = parseFloat(document.getElementById('b').value) || 0;
            document.getElementById('result').textContent = a + b;
        }
        function subtract() {
            const a = parseFloat(document.getElementById('a').value) || 0;
            const b = parseFloat(document.getElementById('b').value) || 0;
            document.getElementById('result').textContent = a - b;
        }
    </script>
</body>
</html>
```
~~~

### Attributes (on the info string line)

- `title="..."` - Display name shown in the header bar (optional)
- `height="..."` - Height in pixels, e.g. `height="400"` (optional, default: 300)
- `url="..."` - URL to load instead of inline HTML (optional)

## Format 2: URL Reference

When referencing an external URL, provide the `url` attribute on the fence line. The code block body can be empty:

~~~
```applet url="https://example.com/widget.html" title="External Widget" height="500"
```
~~~

When `url` is provided, the iframe loads that URL directly. No HTML content is needed.

## Format 3: Minimal (No Attributes)

If no title or height customization is needed, just output the HTML directly between the fences:

~~~
```applet
<div style="padding: 20px; font-family: sans-serif;">
    <h2>Hello World</h2>
    <p>This is a simple inline applet.</p>
    <button onclick="alert('Clicked!')">Click Me</button>
</div>
```
~~~

## Complete Examples

### Example 1: Interactive Chart with Chart.js

~~~
```applet title="Sales Chart" height="350"
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <canvas id="myChart" width="400" height="300"></canvas>
    <script>
        new Chart(document.getElementById('myChart'), {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
                datasets: [{
                    label: 'Sales ($)',
                    data: [12000, 19000, 15000, 25000, 22000],
                    backgroundColor: 'rgba(54, 162, 235, 0.6)'
                }]
            }
        });
    </script>
</body>
</html>
```
~~~

### Example 2: Color Picker Tool

~~~
```applet title="Color Picker" height="200"
<div style="padding: 20px; font-family: system-ui;">
    <input type="color" id="colorPicker" value="#3b82f6" style="width: 100px; height: 50px; cursor: pointer;">
    <p>Selected: <code id="colorValue">#3b82f6</code></p>
    <div id="preview" style="width: 100%; height: 50px; background: #3b82f6; border-radius: 8px; margin-top: 10px;"></div>
    <script>
        document.getElementById('colorPicker').addEventListener('input', function(e) {
            document.getElementById('colorValue').textContent = e.target.value;
            document.getElementById('preview').style.background = e.target.value;
        });
    </script>
</div>
```
~~~

### Example 3: URL-Based Applet (e.g., hosted HTML file)

~~~
```applet url="https://storage.example.com/myapp.html" title="My Hosted App" height="400"
```
~~~

Note: For URL-based applets, the code block body is empty - just the opening and closing fences.

### Example 4: Simple Counter (Minimal)

~~~
```applet
<div style="text-align: center; padding: 40px; font-family: sans-serif;">
    <h1 id="count" style="font-size: 48px;">0</h1>
    <button onclick="document.getElementById('count').textContent = parseInt(document.getElementById('count').textContent) + 1" style="padding: 10px 30px; font-size: 18px; cursor: pointer;">
        Increment
    </button>
</div>
```
~~~

## UI Behavior

When rendered, the applet appears as a card with:

1. **Header bar** showing:
   - Code icon + title
   - Refresh button (reloads the iframe)
   - External link button (only for URL-based applets, opens in new tab)
   - Fullscreen button (expands to 95% viewport dialog)

2. **Iframe area** displaying the interactive content

3. **Loading state** shown while content loads

## Security

- Content runs in a sandboxed iframe with: `allow-scripts allow-forms allow-popups allow-same-origin allow-modals`
- Theme (dark/light mode) is automatically applied
- The applet inherits Tailwind CSS utilities if needed

