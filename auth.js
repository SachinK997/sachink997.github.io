document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    // Handle Registration (Sign Up)
    // In auth.js
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;

            // 1. Create the user in Supabase
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: { data: { full_name: name } }
            });

            if (error) {
                alert("Signup Failed: " + error.message);
            } else if (data.user) {
                // 2. Set session markers
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('userName', name);

                // 3. Show success modal instead of alert
                const modal = document.getElementById('successModal');
                if (modal) {
                    modal.classList.add('active');
                    document.getElementById('btnGoHome').addEventListener('click', () => {
                        window.location.href = 'index.html';
                    });
                } else {
                    window.location.href = 'index.html';
                }
            }
        });
    }

    // Handle Login (Sign In)
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => { // Added 'async'
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            // Use Supabase Auth to sign in
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                const modal = document.getElementById('errorModal');
                const messageEl = document.getElementById('errorMessage');
                if (modal) {
                    if (messageEl) messageEl.innerText = error.message;
                    modal.classList.add('active');
                    document.getElementById('btnRetry').addEventListener('click', () => {
                        modal.classList.remove('active');
                    });
                } else {
                    alert('Login error: ' + error.message);
                }
            } else if (data.user) {
                // Get the user's name from metadata we stored during signup
                const name = data.user.user_metadata.full_name || 'User';

                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('userName', name);
                window.location.href = 'index.html';
            }
        });
    }

    // Handle Reset Password (New Password)
    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('newPassword').value;
            const confirm = document.getElementById('confirmPassword').value;

            if (password !== confirm) {
                alert("Passwords do not match!");
                return;
            }

            const { error } = await supabaseClient.auth.updateUser({
                password: password
            });

            if (error) {
                const modal = document.getElementById('errorModal');
                const messageEl = document.getElementById('errorMessage');
                if (modal) {
                    if (messageEl) messageEl.innerText = error.message;
                    modal.classList.add('active');
                    document.getElementById('btnRetry').addEventListener('click', () => {
                        modal.classList.remove('active');
                    });
                } else {
                    alert("Error: " + error.message);
                }
            } else {
                const modal = document.getElementById('updateSuccessModal');
                if (modal) {
                    modal.classList.add('active');
                    document.getElementById('btnGoToLogin').addEventListener('click', () => {
                        window.location.href = 'login.html';
                    });
                } else {
                    alert("Password updated successfully!");
                    window.location.href = 'login.html';
                }
            }
        });
    }
});