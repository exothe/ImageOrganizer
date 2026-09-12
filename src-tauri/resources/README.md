# Bundled models

## face_detection_yunet_2023mar.onnx

YuNet face detection model, MIT license.

- Source: https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
  (downloaded 2026-07-11 from the `main` branch)
- **Modified**: the upstream export bakes a static 1×3×640×640 input shape and per-node
  shape metadata into the graph, which prevents running it at other resolutions under tract.
  The bundled copy had the input dims replaced with symbolic H/W, all `value_info` entries
  removed, and output shapes cleared:

```python
import onnx
m = onnx.load('face_detection_yunet_2023mar.onnx')
g = m.graph
dims = g.input[0].type.tensor_type.shape.dim
dims[2].dim_param = 'H'; dims[2].ClearField('dim_value')
dims[3].dim_param = 'W'; dims[3].ClearField('dim_value')
del g.value_info[:]
for out in g.output:
    out.type.tensor_type.shape.Clear()
onnx.checker.check_model(m)
onnx.save(m, 'face_detection_yunet_2023mar.onnx')
```

Input: NCHW float32 BGR, raw 0–255, H/W multiples of 32.
Outputs: `cls_{8,16,32}`, `obj_{8,16,32}`, `bbox_{8,16,32}`, `kps_{8,16,32}` (see `src/face_merge/detection.rs`).
