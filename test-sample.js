// Test file with intentional inefficiencies
function findDuplicates(arr) {
  const dupes = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j] && !dupes.includes(arr[i])) {
        dupes.push(arr[i]);
      }
    }
  }
  return dupes;
}

// This should trigger:
// 1. Nested loop (O(n²))
// 2. .includes() in loop (O(n²))
