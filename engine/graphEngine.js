const graphEngine = {
  buildGraph(pairStates) {
    const graph = {};
    for (const ps of pairStates) {
      if (!ps) continue;
      const { tokenA, tokenB } = ps;
      if (!graph[tokenA]) graph[tokenA] = [];
      if (!graph[tokenB]) graph[tokenB] = [];
      graph[tokenA].push({ neighbor: tokenB, pair: ps, direction: 'AB' });
      graph[tokenB].push({ neighbor: tokenA, pair: ps, direction: 'BA' });
    }
    return graph;
  },

  findCycles(graph, maxLen = 4) {
    const cycles = [];
    const dfs = (start, cur, path, edges, visited) => {
      if (path.length > 1 && cur === start) { cycles.push({ path: [...path, start], edges: [...edges] }); return; }
      if (path.length >= maxLen) return;
      for (const edge of (graph[cur] || [])) {
        if (edge.neighbor === start && path.length > 1) { cycles.push({ path: [...path, start], edges: [...edges, edge] }); continue; }
        if (!visited.has(edge.neighbor)) {
          visited.add(edge.neighbor);
          dfs(start, edge.neighbor, [...path, edge.neighbor], [...edges, edge], visited);
          visited.delete(edge.neighbor);
        }
      }
    };
    for (const token of Object.keys(graph)) dfs(token, token, [token], [], new Set([token]));
    const seen = new Set();
    return cycles.filter(c => { const k = c.path.slice(0,-1).sort().join('-'); if (seen.has(k)) return false; seen.add(k); return true; });
  },
};

module.exports = graphEngine;