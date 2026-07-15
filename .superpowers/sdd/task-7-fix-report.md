# Task 7 Fix Report

## Status
DONE

## Final Commit
`f84c402ae0a6d1f8c7b3e2a9d4f5c6b8e1f3a7d9`

## Test Summary
12 tests pass (4 parser + 6 transform + 2 new regression tests).

## Fix Description
In `figma-to-react/scripts/transform.mjs`, the `mapNode` function's text-specific branch now returns immediately after building the text IR node, bypassing the generic `node.children = (astNode.children || []).map(mapNode)` loop at the bottom of the function. Previously, for a `<Text>` AST element the code would:

1. Build a correct `{ type: 'text', text: '...' }` IR node.
2. Fall through to the children-mapping loop below.
3. Recurse into `astNode.children`, which contained parser-AST nodes of shape `{ type: 'Text', value: '...' }`.
4. `mapNode` would match the `astNode.type === 'Text'` guard at the top of the function and return another `{ type: 'text', text: '...' }` node, pushing it as a phantom child of the first.

The fix adds a `return node` statement at the end of the `if (mapped === 'text')` block. The text content is already correctly extracted from `astNode.children` into the `text` field — recursing further would only produce the phantom duplicate.

## Concerns
None.

## Test Output
```
✔ parseJsx returns root Element with tag Frame
✔ parseJsx extracts top-level props (name, width, height)
✔ parseJsx returns 2 children for simple-frame
✔ parseJsx extracts text content of Text node
✔ parseJsx handles nested frames without crashing
✔ parseJsx produces correct AST shape for nested-frames
✔ transform simple-frame.jsx → IR has type=frame root with name=Button
✔ transform simple-frame → IR has 2 children: rectangle and text
✔ transform nested-frames.jsx → vertical root with two children, both frames
✔ transform rejects unknown element tag with a clear error
✔ transform simple-frame → text node has no phantom text child
✔ transform nested-frames → body text node has no phantom text child
ℹ tests 12 / pass 12 / fail 0
```
