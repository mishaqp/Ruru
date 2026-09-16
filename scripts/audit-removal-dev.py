"""Temporary GitHub-only patch; source repairs are already committed."""
from pathlib import Path
import subprocess

p = Path('app/build.gradle.kts')
s = p.read_text()
anchor = '    implementation(project(":shared"))\n'
addition = '    implementation(libs.kotlinx.serialization.json)\n'
assert s.count(anchor) == 1
if addition not in s:
    s = s.replace(anchor, anchor + addition, 1)
    p.write_text(s)
subprocess.run(['git', 'add', 'app/build.gradle.kts'], check=True)
print('Android now declares the same existing JSON runtime as shared; no new library version.')
