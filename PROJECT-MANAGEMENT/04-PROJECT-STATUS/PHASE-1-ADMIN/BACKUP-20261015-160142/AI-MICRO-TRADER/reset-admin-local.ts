import { db } from './src/server/db';
import { execFileSync } from 'node:child_process';

const admin = db.getAdminByUsername('test_admin');

if (!admin) {
  console.error('Existing administrator not found.');
  process.exit(1);
}

const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = 'AI Micro Trader - Reset Admin Password'
$form.Size = New-Object System.Drawing.Size(440,260)
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true

$label1 = New-Object System.Windows.Forms.Label
$label1.Text = 'New password (at least 12 characters):'
$label1.SetBounds(20,20,380,25)
$form.Controls.Add($label1)

$pass1 = New-Object System.Windows.Forms.TextBox
$pass1.SetBounds(20,50,380,25)
$pass1.UseSystemPasswordChar = $true
$form.Controls.Add($pass1)

$label2 = New-Object System.Windows.Forms.Label
$label2.Text = 'Confirm new password:'
$label2.SetBounds(20,90,380,25)
$form.Controls.Add($label2)

$pass2 = New-Object System.Windows.Forms.TextBox
$pass2.SetBounds(20,120,380,25)
$pass2.UseSystemPasswordChar = $true
$form.Controls.Add($pass2)

$button = New-Object System.Windows.Forms.Button
$button.Text = 'Confirm Reset'
$button.SetBounds(145,160,140,30)
$button.Add_Click({
  if ($pass1.Text.Length -lt 12) {
    [System.Windows.Forms.MessageBox]::Show('Password must be at least 12 characters.')
    return
  }
  if ($pass1.Text -cne $pass2.Text) {
    [System.Windows.Forms.MessageBox]::Show('Passwords do not match.')
    return
  }
  $form.Tag = $pass1.Text
  $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
  $form.Close()
})
$form.Controls.Add($button)

$form.AcceptButton = $button
$form.Add_Shown({ $pass1.Focus() })

if ($form.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Write($form.Tag)
}
`;

const password = execFileSync(
  'powershell.exe',
  ['-NoProfile', '-STA', '-Command', script],
  { encoding: 'utf8' }
);

if (password.length < 12) {
  console.error('Password reset cancelled. No changes made.');
  process.exit(1);
}

db.createOrUpdateAdmin('test_admin', password);

console.log('ADMIN PASSWORD RESET SUCCESSFUL');
