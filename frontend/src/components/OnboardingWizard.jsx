import React, { useState } from 'react';

const OnboardingWizard = ({ onComplete, onSkip }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        // Demographics
        name: '',
        age_range: '',
        income_range: '',
        employment_status: '',
        occupation: '',
        household_size: 1,

        // Financials
        primary_goal: '',
        risk_tolerance: '',
        investment_experience: '',
        monthly_income: '',
        total_debt: '',

        // Preferences
        advice_tone: 'friendly'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const totalSteps = 4;

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const nextStep = () => {
        if (step < totalSteps) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);

        try {
            const payload = {
                demographics: {
                    age_range: formData.age_range,
                    income_range: formData.income_range,
                    employment_status: formData.employment_status,
                    occupation: formData.occupation,
                    household_size: parseInt(formData.household_size) || 1
                },
                financials: {
                    primary_goal: formData.primary_goal,
                    risk_tolerance: formData.risk_tolerance,
                    investment_experience: formData.investment_experience,
                    monthly_income: parseFloat(formData.monthly_income) || 0,
                    total_debt: parseFloat(formData.total_debt) || 0
                },
                preferences: {
                    advice_tone: formData.advice_tone
                }
            };

            // Update name if provided
            if (formData.name) {
                await fetch('http://localhost:5001/api/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: formData.name })
                });
            }

            // Submit onboarding data
            const res = await fetch('http://localhost:5001/api/profile/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                onComplete();
            } else {
                console.error('Onboarding failed');
            }
        } catch (error) {
            console.error('Error submitting onboarding:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSkip = async () => {
        try {
            // Mark as skipped in backend
            await fetch('http://localhost:5001/api/profile/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skipped: true })
            });
        } catch (error) {
            console.error('Error skipping onboarding:', error);
        }
        onSkip();
    };

    const SelectButton = ({ value, current, onClick, children }) => (
        <button
            type="button"
            onClick={() => onClick(value)}
            className={`px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${current === value
                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                }`}
        >
            {children}
        </button>
    );

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">Welcome! Let's get to know you</h2>
                            <p className="text-gray-400">This helps us personalize your financial advice.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">What should we call you?</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => updateField('name', e.target.value)}
                                placeholder="Your name"
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">What's your age range?</label>
                            <div className="grid grid-cols-3 gap-3">
                                {['18-24', '25-34', '35-44', '45-54', '55-64', '65+'].map((range) => (
                                    <SelectButton
                                        key={range}
                                        value={range}
                                        current={formData.age_range}
                                        onClick={(v) => updateField('age_range', v)}
                                    >
                                        {range}
                                    </SelectButton>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">Household size</label>
                            <div className="grid grid-cols-5 gap-3">
                                {[1, 2, 3, 4, '5+'].map((size) => (
                                    <SelectButton
                                        key={size}
                                        value={size}
                                        current={formData.household_size}
                                        onClick={(v) => updateField('household_size', v)}
                                    >
                                        {size}
                                    </SelectButton>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">Your financial situation</h2>
                            <p className="text-gray-400">This helps us give relevant advice.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">Annual income range</label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { value: 'under_30k', label: 'Under $30k' },
                                    { value: '30k-50k', label: '$30k - $50k' },
                                    { value: '50k-75k', label: '$50k - $75k' },
                                    { value: '75k-100k', label: '$75k - $100k' },
                                    { value: '100k-150k', label: '$100k - $150k' },
                                    { value: '150k+', label: '$150k+' }
                                ].map((opt) => (
                                    <SelectButton
                                        key={opt.value}
                                        value={opt.value}
                                        current={formData.income_range}
                                        onClick={(v) => updateField('income_range', v)}
                                    >
                                        {opt.label}
                                    </SelectButton>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">Employment status</label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { value: 'employed', label: '💼 Employed' },
                                    { value: 'self_employed', label: '🏠 Self-employed' },
                                    { value: 'student', label: '📚 Student' },
                                    { value: 'retired', label: '🌴 Retired' }
                                ].map((opt) => (
                                    <SelectButton
                                        key={opt.value}
                                        value={opt.value}
                                        current={formData.employment_status}
                                        onClick={(v) => updateField('employment_status', v)}
                                    >
                                        {opt.label}
                                    </SelectButton>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Approximate total debt (optional)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                <input
                                    type="number"
                                    value={formData.total_debt}
                                    onChange={(e) => updateField('total_debt', e.target.value)}
                                    placeholder="0"
                                    className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">Your financial goals</h2>
                            <p className="text-gray-400">What matters most to you right now?</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">Primary financial goal</label>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { value: 'save_emergency', label: '🚨 Build emergency fund', desc: 'Save 3-6 months of expenses' },
                                    { value: 'pay_debt', label: '💳 Pay off debt', desc: 'Eliminate credit cards, loans' },
                                    { value: 'invest', label: '📈 Start investing', desc: 'Grow wealth over time' },
                                    { value: 'retirement', label: '🏖️ Save for retirement', desc: 'Secure your future' },
                                    { value: 'buy_home', label: '🏠 Buy a home', desc: 'Save for a down payment' }
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => updateField('primary_goal', opt.value)}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${formData.primary_goal === opt.value
                                                ? 'border-purple-500 bg-purple-500/20'
                                                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="font-medium text-white">{opt.label}</div>
                                        <div className="text-sm text-gray-400">{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">Almost done!</h2>
                            <p className="text-gray-400">A few more questions to customize your experience.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">Investment experience</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { value: 'none', label: '🌱 None' },
                                    { value: 'beginner', label: '📘 Beginner' },
                                    { value: 'intermediate', label: '📊 Intermediate' },
                                    { value: 'advanced', label: '🎯 Advanced' }
                                ].map((opt) => (
                                    <SelectButton
                                        key={opt.value}
                                        value={opt.value}
                                        current={formData.investment_experience}
                                        onClick={(v) => updateField('investment_experience', v)}
                                    >
                                        {opt.label}
                                    </SelectButton>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">Risk tolerance</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { value: 'conservative', label: '🛡️ Conservative' },
                                    { value: 'moderate', label: '⚖️ Moderate' },
                                    { value: 'aggressive', label: '🚀 Aggressive' }
                                ].map((opt) => (
                                    <SelectButton
                                        key={opt.value}
                                        value={opt.value}
                                        current={formData.risk_tolerance}
                                        onClick={(v) => updateField('risk_tolerance', v)}
                                    >
                                        {opt.label}
                                    </SelectButton>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">How should I communicate with you?</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { value: 'friendly', label: '😊 Friendly' },
                                    { value: 'professional', label: '👔 Professional' },
                                    { value: 'motivational', label: '💪 Motivational' }
                                ].map((opt) => (
                                    <SelectButton
                                        key={opt.value}
                                        value={opt.value}
                                        current={formData.advice_tone}
                                        onClick={(v) => updateField('advice_tone', v)}
                                    >
                                        {opt.label}
                                    </SelectButton>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-gray-800 shadow-2xl">
                {/* Progress bar */}
                <div className="h-1 bg-gray-800">
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                        style={{ width: `${(step / totalSteps) * 100}%` }}
                    />
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {renderStep()}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 flex justify-between items-center">
                    <div>
                        {step === 1 ? (
                            <button
                                onClick={handleSkip}
                                className="text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors"
                            >
                                Skip for now
                            </button>
                        ) : (
                            <button
                                onClick={prevStep}
                                className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
                            >
                                ← Back
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-sm">
                            {step} of {totalSteps}
                        </span>

                        {step < totalSteps ? (
                            <button
                                onClick={nextStep}
                                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all"
                            >
                                Continue →
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? 'Saving...' : '✓ Complete'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingWizard;
