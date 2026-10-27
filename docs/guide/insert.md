# Insert commands

The **Insert** tab is the command palette for adding path commands to the path.

## Command palette

Each button describes one SVG path command, with prerequisite hints where a command expects an existing selection or subpath state:

| Button | Command | Inserts |
| --- | --- | --- |
| `M` | Moveto | Starts a path or a new subpath. |
| `L` | Lineto | A straight segment to the next point. |
| `H` | Horizontal lineto | A horizontal line; shorthand for a vertical-aligned relative line. |
| `V` | Vertical lineto | A vertical line. |
| `C` | Cubic bézier | Two control points plus an endpoint. |
| `S` | Smooth cubic | A cubic whose first control point reflects the previous curve. |
| `Q` | Quadratic bézier | One control point plus an endpoint. |
| `T` | Smooth quadratic | A quadratic whose control point reflects the previous curve. |
| `A` | Arc | An elliptical arc segment. |
| `Z` | Closepath | Closes the subpath back to its start point. |

## Reference image

Load a **reference image** to trace over, and clear it when done. The image stays local — nothing is uploaded.

## Placement hint

The panel keeps a live hint telling you where the next inserted command will land, so solo beginners can follow the cursor math without reading the raw `d` string.

After insertion, adjustment happens on the [canvas](/guide/canvas) or in the [command panel](/guide/canvas#points-and-handles) sidebar rows.
