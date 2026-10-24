import React, { useMemo } from 'react';
import { Joyride } from 'react-joyride';
import { Lottie } from 'lottie-react';
import clickAnimation from '../public/animations/touch-to-screen.json';
import { getTutorialText } from './tutorialTranslations';

export default function OnboardingTour({
  role,
  lang = 'en',
  run = false,
  tutorialReplay = 0,
  onComplete,
  onEvent,
  onCookTabChange,
  onCustomerPageChange,
}) {
  const text = (key) => getTutorialText(lang, role, key);
  const common = (key) => getTutorialText(lang, role, key);

  const steps = useMemo(() => {
    const makeStep = (
      id,
      target,
      titleKey,
      contentKey,
      placement = 'bottom',
      before
    ) => ({
      id,
      target,
      title: text(titleKey),
      content: (
        <div className="mp-tour-content">
          <p>{text(contentKey)}</p>
          <Lottie
            animationData={clickAnimation}
            loop
            autoplay
            className="mp-tour-animation"
            aria-label="Animated hand demonstrating where to click"
          />
        </div>
      ),
      placement,
      skipBeacon: true,
      spotlightPadding: 8,
      ...(before ? { before } : {}),
    });

    if (role === 'cook') {
      const selectTab = (tab) => async () => {
        if (typeof onCookTabChange === 'function') {
          await onCookTabChange(tab);
        }
      };

      return [
        makeStep(
          'cook-intro',
          '[data-tour="cook-dashboard"]',
          'title',
          'intro',
          'bottom',
          selectTab('application')
        ),
        makeStep(
          'cook-application',
          '[data-tour="cook-application"]',
          'applicationTitle',
          'application',
          'bottom',
          selectTab('application')
        ),
        makeStep(
          'cook-profile',
          '[data-tour="cook-profile"]',
          'profileTitle',
          'profile',
          'bottom',
          selectTab('profile')
        ),
        makeStep(
          'cook-menu',
          '[data-tour="cook-menu"]',
          'menuTitle',
          'menu',
          'bottom',
          selectTab('menu')
        ),
        makeStep(
          'cook-orders',
          '[data-tour="cook-orders"]',
          'ordersTitle',
          'orders',
          'bottom',
          selectTab('orders')
        ),
      ];
    }

    return [
      makeStep(
        'customer-intro',
        '[data-tour="customer-discovery"]',
        'title',
        'intro',
        'bottom'
      ),
      makeStep(
        'customer-search',
        '[data-tour="customer-search"]',
        'searchTitle',
        'search'
      ),
      makeStep(
        'customer-food',
        '[data-tour="customer-food"]',
        'foodTitle',
        'food'
      ),
      makeStep(
        'customer-kitchen',
        '[data-tour="customer-kitchen"]',
        'kitchenTitle',
        'kitchen'
      ),
      makeStep(
        'customer-order',
        '[data-tour="customer-order"]',
        'orderTitle',
        'order'
      ),
      makeStep(
        'customer-history',
        '[data-tour="customer-history"]',
        'historyTitle',
        'history',
        'bottom',
        async () => {
          if (typeof onCustomerPageChange === 'function') {
            await onCustomerPageChange('orders');
          }
        }
      ),
      makeStep(
        'customer-review',
        '[data-tour="customer-review"]',
        'reviewTitle',
        'review'
      ),
    ];
  }, [role, lang, onCookTabChange, onCustomerPageChange, tutorialReplay]);

  if (role !== 'cook' && role !== 'customer') return null;

  return (
    <Joyride
      key={`${role}-${tutorialReplay}`}
      run={run}
      steps={steps}
      continuous
      showProgress
      scrollToFirstStep
      onEvent={(eventData, controls) => {
        if (typeof onEvent === 'function') {
          onEvent(eventData, controls);
        }

        if (
          eventData.status === 'finished' ||
          eventData.status === 'skipped'
        ) {
          onComplete?.(eventData.status);
        }
      }}
      locale={{
        back: common('back'),
        close: common('close'),
        last: common('finish'),
        next: common('next'),
        skip: common('skip'),
      }}
      options={{
        overlayColor: 'rgba(22, 35, 29, 0.68)',
        primaryColor: '#26734d',
        textColor: '#203128',
        backgroundColor: '#ffffff',
        arrowColor: '#ffffff',
        spotlightRadius: 14,
        zIndex: 10000,
      }}
    />
  );
}
